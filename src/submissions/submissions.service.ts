import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Submission } from './submission.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { SubmissionResponse } from './submission.response';
import { CampaignStatus, ReviewDecision, SubmissionStatus } from '../common/enums';
import { CampaignsService } from '../campaigns/campaigns.service';
import type { CampaignMediaVariant } from '../campaigns/campaign.entity';
import { GroupsService } from '../groups/groups.service';
import { WalletService } from '../wallet/wallet.service';
import { RequestUser } from '../common/types/jwt-payload';
import { GcsStorageService, SignedUploadUrlResponse } from '../storage/gcs-storage.service';
import { CreateProofUploadUrlDto } from './dto/create-proof-upload-url.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { WorkerPerformanceService } from '../worker-performance/worker-performance.service';
import { SubmissionAiVerificationService } from './submission-ai-verification.service';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission) private readonly submissionsRepository: Repository<Submission>,
    private readonly campaignsService: CampaignsService,
    private readonly groupsService: GroupsService,
    private readonly walletService: WalletService,
    private readonly storageService: GcsStorageService,
    private readonly auditLogsService: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly workerPerformanceService: WorkerPerformanceService,
    private readonly submissionAiVerificationService: SubmissionAiVerificationService,
  ) {}

  async createProofUploadUrl(workerId: number, dto: CreateProofUploadUrlDto): Promise<SignedUploadUrlResponse> {
    return this.storageService.createSubmissionProofUploadUrl({
      workerId,
      campaignId: dto.campaignId,
      fileName: dto.fileName,
      contentType: dto.contentType,
    });
  }

  async findAll(workerId?: number, status?: SubmissionStatus): Promise<SubmissionResponse[]> {
    const where: Record<string, unknown> = {};
    if (workerId) where.workerId = workerId;
    if (status) where.status = status;

    const submissions = await this.submissionsRepository.find({
      where,
      relations: { campaign: true, worker: true, group: true },
      order: { submittedAt: 'DESC' },
    });
    return submissions.map((submission) => this.toResponse(submission));
  }

  async create(currentUser: RequestUser, dto: CreateSubmissionDto): Promise<SubmissionResponse> {
    await this.workerPerformanceService.requireNotFlagged(currentUser.id);
    await this.groupsService.enforceCooldownAvailability(currentUser.id, dto.campaignId, dto.groupId);

    const campaign = await this.campaignsService.findEntityById(dto.campaignId);
    if (campaign.status !== CampaignStatus.ACTIVE) {
      throw new BadRequestException('Campaign is not active');
    }

    const now = Date.now();
    if (campaign.startDate.getTime() > now) {
      throw new BadRequestException('Campaign has not started yet');
    }
    if (campaign.endDate.getTime() < now) {
      throw new BadRequestException('Campaign has already ended');
    }

    const group = await this.groupsService.findEntityById(dto.groupId);
    const assignedMediaVariant = this.campaignsService.pickRandomMediaVariant(campaign) as CampaignMediaVariant | null;
    const verificationSettings = {
      screenshotRequired: campaign.screenshotRequired,
      facebookPostUrlRequired: campaign.facebookPostUrlRequired,
      groupNameRequired: campaign.groupNameRequired,
      manualReviewRequired: campaign.manualReviewRequired,
      aiVerificationEnabled: campaign.aiVerificationEnabled,
      autoApprovalEnabled: campaign.autoApprovalEnabled,
    };

    const proofUrl = dto.proofUrl?.trim() || null;
    const facebookPostUrl = dto.facebookPostUrl?.trim() || null;
    const submittedGroupName = dto.groupName?.trim() || null;
    const requiresScreenshot = verificationSettings.screenshotRequired || verificationSettings.aiVerificationEnabled;

    if (requiresScreenshot && !proofUrl) {
      throw new BadRequestException('Screenshot proof is required for this campaign');
    }
    if (verificationSettings.facebookPostUrlRequired && !facebookPostUrl) {
      throw new BadRequestException('Facebook post URL is required for this campaign');
    }
    if (verificationSettings.groupNameRequired) {
      if (!submittedGroupName) {
        throw new BadRequestException('Group name is required for this campaign');
      }
      if (submittedGroupName.trim().toLowerCase() !== group.name.trim().toLowerCase()) {
        throw new BadRequestException('Group name does not match the selected group');
      }
    }

    const verification = proofUrl
      ? await this.runPreReviewChecks({
          proofUrl,
          caption: dto.caption,
          groupId: dto.groupId,
          campaignId: dto.campaignId,
          expectedGroupName: group.name,
          submittedGroupName,
          aiVerificationEnabled: verificationSettings.aiVerificationEnabled,
        })
      : {
          duplicateProofDetected: false,
          duplicateUrlDetected: false,
          screenshotVisible: false,
          ocrText: '',
          captionMatch: false,
          imageMatch: false,
          groupNameMatch: false,
          dateVisible: false,
          timeVisible: false,
          aiVerificationAvailable: false,
          aiAutoApproveRecommended: false,
          confidence: 0,
          explanation: 'Verification not required by campaign settings',
        };
    const fraud = await this.calculateFraudRisk(currentUser.id, dto.campaignId, dto.groupId, verification);

    let status = SubmissionStatus.PENDING;
    let reviewNote: string | null = null;
    if (verificationSettings.manualReviewRequired) {
      status = SubmissionStatus.MANUAL_REVIEW;
      reviewNote = 'Manual review required by campaign settings.';
    } else if (verificationSettings.aiVerificationEnabled) {
      if (verification.duplicateProofDetected || verification.duplicateUrlDetected || fraud.flaggedForFraud) {
        status = SubmissionStatus.MANUAL_REVIEW;
        reviewNote = fraud.flaggedForFraud
          ? `Fraud risk score ${fraud.fraudRiskScore}. Manual review required.`
          : 'Duplicate risk detected. Manual review required.';
      } else if (!verification.aiVerificationAvailable) {
        status = SubmissionStatus.MANUAL_REVIEW;
        reviewNote = 'AI verification service unavailable. Sent to manual review.';
      } else if (verification.aiAutoApproveRecommended) {
        status = SubmissionStatus.APPROVED;
        reviewNote = `Auto-approved by AI verification (confidence ${Math.round(verification.confidence * 100)}%).`;
      } else {
        status = SubmissionStatus.MANUAL_REVIEW;
        reviewNote = `AI confidence ${Math.round(verification.confidence * 100)}% is below auto-approval threshold.`;
      }
    } else if (verificationSettings.autoApprovalEnabled) {
      status = SubmissionStatus.APPROVED;
      reviewNote = 'Auto-approved by campaign settings.';
    }

    const submission = this.submissionsRepository.create({
      campaignId: campaign.id,
      campaign,
      workerId: currentUser.id,
      groupId: group.id,
      group,
      status,
      proofUrl,
      facebookPostUrl,
      submittedGroupName,
      assignedMediaVariant,
      caption: dto.caption,
      rewardMinor: campaign.rewardPerPostMinor,
      reviewedAt: null,
      reviewNote,
      verificationConfidence: verification.confidence,
      verificationExplanation: verification.explanation,
      duplicateProofDetected: verification.duplicateProofDetected,
      duplicateUrlDetected: verification.duplicateUrlDetected,
      fraudRiskScore: fraud.fraudRiskScore,
      flaggedForFraud: fraud.flaggedForFraud,
      fraudSignals: fraud.signals,
    });
    const saved = await this.submissionsRepository.save(submission);

    if (status === SubmissionStatus.APPROVED) {
      saved.reviewedAt = new Date();
      await this.submissionsRepository.save(saved);
      await this.walletService.approvePendingReward(currentUser.id, saved.rewardMinor);
      await this.campaignsService.recordApprovedSpend(saved.campaignId, saved.rewardMinor);
      await this.groupsService.registerApprovedSubmission(currentUser.id, saved.campaignId, saved.groupId);
      await this.auditLogsService.record({
        action: 'submission.review.approved',
        resourceType: 'Submission',
        resourceId: String(saved.id),
        metadata: { campaignId: saved.campaignId, workerId: saved.workerId, groupId: saved.groupId },
      });
      this.eventEmitter.emit('submission.reviewed', {
        submissionId: saved.id,
        workerId: saved.workerId,
        campaignId: saved.campaignId,
        status: saved.status,
        note: saved.reviewNote,
      });
    }

    await this.workerPerformanceService.applyFraudSignal(
      currentUser.id,
      fraud.fraudRiskScore,
      typeof fraud.signals.reason === 'string' ? fraud.signals.reason : 'Elevated fraud risk',
    );

    await this.walletService.registerPendingReward(currentUser.id, saved.rewardMinor);

    const withWorker = await this.submissionsRepository.findOne({
      where: { id: saved.id },
      relations: { campaign: true, worker: true, group: true },
    });

    this.eventEmitter.emit('submission.created', {
      submissionId: saved.id,
      workerId: saved.workerId,
      campaignId: saved.campaignId,
      status: saved.status,
      duplicateProofDetected: saved.duplicateProofDetected,
      duplicateUrlDetected: saved.duplicateUrlDetected,
      fraudRiskScore: saved.fraudRiskScore,
      flaggedForFraud: saved.flaggedForFraud,
    });

    return this.toResponse(withWorker as Submission);
  }

  async review(id: number, decision: ReviewDecision, note?: string, actorId?: number): Promise<SubmissionResponse> {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
      relations: { campaign: true, worker: true, group: true },
    });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    submission.reviewedAt = new Date();
    submission.reviewNote = note ?? null;

    if (decision === ReviewDecision.APPROVE) {
      submission.status = SubmissionStatus.APPROVED;
      await this.walletService.approvePendingReward(submission.workerId, submission.rewardMinor);
      await this.campaignsService.recordApprovedSpend(submission.campaignId, submission.rewardMinor);
      await this.groupsService.registerApprovedSubmission(submission.workerId, submission.campaignId, submission.groupId);
    } else if (decision === ReviewDecision.REJECT) {
      submission.status = SubmissionStatus.REJECTED;
      await this.walletService.rejectPendingReward(submission.workerId, submission.rewardMinor);
    } else {
      submission.status = SubmissionStatus.PENDING;
    }

    const saved = await this.submissionsRepository.save(submission);
    await this.auditLogsService.record({
      actorId,
      action: `submission.review.${saved.status.toLowerCase()}`,
      resourceType: 'Submission',
      resourceId: String(saved.id),
      metadata: { campaignId: saved.campaignId, workerId: saved.workerId, groupId: saved.groupId },
    });

    await this.workerPerformanceService.recomputeForWorker(saved.workerId);

    this.eventEmitter.emit('submission.reviewed', {
      submissionId: saved.id,
      workerId: saved.workerId,
      campaignId: saved.campaignId,
      status: saved.status,
      note: saved.reviewNote,
    });

    return this.toResponse(saved);
  }

  private async calculateFraudRisk(
    workerId: number,
    campaignId: number,
    groupId: number,
    verification: { duplicateProofDetected: boolean; duplicateUrlDetected: boolean },
  ) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentSubmissions = await this.submissionsRepository
      .createQueryBuilder('submission')
      .where('submission.workerId = :workerId', { workerId })
      .andWhere('submission.submittedAt >= :oneHourAgo', { oneHourAgo })
      .getCount();

    const recentGroupReuse = await this.submissionsRepository
      .createQueryBuilder('submission')
      .where('submission.workerId = :workerId', { workerId })
      .andWhere('submission.groupId = :groupId', { groupId })
      .andWhere('submission.campaignId = :campaignId', { campaignId })
      .andWhere('submission.submittedAt >= :oneDayAgo', { oneDayAgo })
      .getCount();

    let risk = 10;
    if (verification.duplicateProofDetected) risk += 35;
    if (verification.duplicateUrlDetected) risk += 30;
    if (recentSubmissions >= 5) risk += 20;
    if (recentGroupReuse >= 3) risk += 15;

    const fraudRiskScore = Math.max(0, Math.min(100, risk));
    const flaggedForFraud = fraudRiskScore >= 65;

    return {
      fraudRiskScore,
      flaggedForFraud,
      signals: {
        duplicateProofDetected: verification.duplicateProofDetected,
        duplicateUrlDetected: verification.duplicateUrlDetected,
        recentSubmissions,
        recentGroupReuse,
        reason: flaggedForFraud
          ? 'Multiple duplicate/behavioral risk signals detected'
          : 'Risk within acceptable threshold',
      },
    };
  }

  private async runPreReviewChecks(params: {
    proofUrl: string;
    caption: string;
    groupId: number;
    campaignId: number;
    expectedGroupName: string;
    submittedGroupName: string | null;
    aiVerificationEnabled: boolean;
  }) {
    const normalizedProof = params.proofUrl.trim().toLowerCase();
    const normalizedCaption = params.caption.trim().toLowerCase();

    const duplicateUrlDetected =
      (await this.submissionsRepository.count({
        where: { proofUrl: params.proofUrl.trim() },
      })) > 0;

    const candidateSubmissions = await this.submissionsRepository.find({
      where: { groupId: params.groupId, campaignId: params.campaignId },
      take: 50,
      order: { submittedAt: 'DESC' },
    });

    const duplicateProofDetected = candidateSubmissions.some((existing) => {
      const existingProof = existing.proofUrl?.trim().toLowerCase() ?? null;
      const existingCaption = existing.caption.trim().toLowerCase();

      if (existingProof && existingProof === normalizedProof) {
        return true;
      }

      if (!existingCaption || !normalizedCaption) {
        return false;
      }

      const captionSimilarity = this.calculateJaccardSimilarity(existingCaption, normalizedCaption);
      return captionSimilarity >= 0.92;
    });

    const aiVerification = params.aiVerificationEnabled
      ? await this.submissionAiVerificationService.verifyScreenshot({
          proofUrl: params.proofUrl,
          caption: params.caption,
          expectedGroupName: params.expectedGroupName,
          submittedGroupName: params.submittedGroupName,
        })
      : {
          available: false,
          screenshotVisible: false,
          ocrText: '',
          captionMatch: false,
          imageMatch: false,
          groupNameMatch: false,
          dateVisible: false,
          timeVisible: false,
          confidence: 0,
          notes: 'AI verification disabled for this campaign',
        };

    let confidence = 0.75;
    if (params.aiVerificationEnabled && aiVerification.available) {
      const weightedScore =
        (aiVerification.screenshotVisible ? 0.15 : 0) +
        (aiVerification.ocrText.length > 0 ? 0.1 : 0) +
        (aiVerification.captionMatch ? 0.2 : 0) +
        (aiVerification.imageMatch ? 0.2 : 0) +
        (aiVerification.groupNameMatch ? 0.15 : 0) +
        (aiVerification.dateVisible ? 0.1 : 0) +
        (aiVerification.timeVisible ? 0.1 : 0);
      confidence = Math.max(confidence, Number((weightedScore * 0.9 + aiVerification.confidence * 0.1).toFixed(2)));
    } else if (params.aiVerificationEnabled && !aiVerification.available) {
      confidence = 0.35;
    }

    if (duplicateProofDetected) confidence -= 0.4;
    if (duplicateUrlDetected) confidence -= 0.3;
    confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(2))));

    const threshold = this.submissionAiVerificationService.getAutoApproveThreshold();
    const aiAutoApproveRecommended = params.aiVerificationEnabled && aiVerification.available && confidence >= threshold;

    const explanationParts = [
      duplicateProofDetected ? 'Similar proof content detected' : 'Proof appears unique in recent campaign-group history',
      duplicateUrlDetected ? 'Proof URL already submitted earlier' : 'Proof URL not seen before',
      params.aiVerificationEnabled
        ? aiVerification.available
          ? `AI checks: screenshot=${aiVerification.screenshotVisible}, ocrText=${aiVerification.ocrText.length > 0}, captionMatch=${aiVerification.captionMatch}, imageMatch=${aiVerification.imageMatch}, groupNameMatch=${aiVerification.groupNameMatch}, dateVisible=${aiVerification.dateVisible}, timeVisible=${aiVerification.timeVisible}`
          : `AI checks unavailable: ${aiVerification.notes}`
        : 'AI verification disabled',
      `Confidence ${Math.round(confidence * 100)}%`,
    ];

    return {
      duplicateProofDetected,
      duplicateUrlDetected,
      screenshotVisible: aiVerification.screenshotVisible,
      ocrText: aiVerification.ocrText,
      captionMatch: aiVerification.captionMatch,
      imageMatch: aiVerification.imageMatch,
      groupNameMatch: aiVerification.groupNameMatch,
      dateVisible: aiVerification.dateVisible,
      timeVisible: aiVerification.timeVisible,
      aiVerificationAvailable: aiVerification.available,
      aiAutoApproveRecommended,
      confidence,
      explanation: explanationParts.join(' | '),
    };
  }

  private calculateJaccardSimilarity(a: string, b: string): number {
    const tokenize = (input: string) =>
      new Set(
        input
          .split(/\s+/)
          .map((token) => token.trim())
          .filter(Boolean),
      );

    const aSet = tokenize(a);
    const bSet = tokenize(b);
    if (aSet.size === 0 && bSet.size === 0) {
      return 1;
    }

    let intersection = 0;
    for (const token of aSet) {
      if (bSet.has(token)) {
        intersection += 1;
      }
    }

    const union = new Set([...aSet, ...bSet]).size;
    if (union === 0) {
      return 0;
    }

    return intersection / union;
  }

  private toResponse(submission: Submission): SubmissionResponse {
    return {
      id: submission.id,
      campaignId: submission.campaignId,
      campaignName: submission.campaign.name,
      workerId: submission.workerId,
      workerName: `${submission.worker.firstName} ${submission.worker.lastName}`,
      groupId: submission.groupId,
      groupName: submission.group.name,
      status: submission.status,
      proofUrl: submission.proofUrl,
      facebookPostUrl: submission.facebookPostUrl,
      submittedGroupName: submission.submittedGroupName,
      assignedMediaVariant: submission.assignedMediaVariant ?? null,
      caption: submission.caption,
      rewardMinor: submission.rewardMinor,
      submittedAt: submission.submittedAt.toISOString(),
      reviewedAt: submission.reviewedAt ? submission.reviewedAt.toISOString() : null,
      reviewNote: submission.reviewNote ?? '',
      verificationConfidence: submission.verificationConfidence,
      verificationExplanation: submission.verificationExplanation ?? '',
      duplicateProofDetected: submission.duplicateProofDetected,
      duplicateUrlDetected: submission.duplicateUrlDetected,
      fraudRiskScore: submission.fraudRiskScore,
      flaggedForFraud: submission.flaggedForFraud,
      fraudSignals: submission.fraudSignals ?? {},
    };
  }
}

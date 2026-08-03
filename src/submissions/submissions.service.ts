import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  FraudRiskAssessment,
  PreReviewCheckResult,
  SubmissionResponse,
  SubmissionStatusDecision,
  SubmissionVerificationSettings,
} from '../interfaces/submissions.interface';
import { normalizeComparableText, trimToNull } from '../common/utils/string.utils';
import { CreateProofUploadUrlDto, CreateSubmissionDto } from '../dto/submissions.dto';
import { Submission } from './submission.entity';
import { CampaignStatus, ReviewDecision, SubmissionStatus, UserRole } from '../common/enums';
import { CampaignsService } from '../campaigns/campaigns.service';
import type { CampaignMediaVariant } from '../interfaces/campaigns.interface';
import { GroupsService } from '../groups/groups.service';
import { WalletService } from '../wallet/wallet.service';
import { RequestUser } from '../interfaces/auth.interface';
import { GcsStorageService } from '../storage/gcs-storage.service';
import { SignedUploadUrlResponse } from '../interfaces/storage.interface';
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

  async uploadProof(workerId: number, campaignId: number | undefined, file: Express.Multer.File): Promise<{ proofUrl: string; objectKey: string }> {
    return this.storageService.uploadSubmissionProof({ workerId, campaignId, file });
  }

  async createProofUploadUrl(workerId: number, dto: CreateProofUploadUrlDto): Promise<SignedUploadUrlResponse> {
    return this.storageService.createSubmissionProofUploadUrl({
      workerId,
      campaignId: dto.campaignId,
      fileName: dto.fileName,
      contentType: dto.contentType,
    });
  }

  async getProofSignedUrl(currentUser: RequestUser, submissionId: number): Promise<{ signedUrl: string; expiresAt: string }> {
    const submission = await this.submissionsRepository.findOne({
      where: { id: submissionId },
    });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }
    if (currentUser.role === UserRole.WORKER && submission.workerId !== currentUser.id) {
      throw new NotFoundException('Submission not found');
    }
    if (!submission.proofUrl) {
      throw new NotFoundException('No proof uploaded for this submission');
    }
    const expirationSeconds = 3600;
    const signedUrl = await this.storageService.createSignedReadUrl(submission.proofUrl, expirationSeconds);
    const expiresAt = new Date(Date.now() + expirationSeconds * 1000).toISOString();
    return { signedUrl, expiresAt };
  }

  async findAll(currentUser: RequestUser, workerId?: number, status?: SubmissionStatus): Promise<SubmissionResponse[]> {
    const where: Record<string, unknown> = {};

    if (currentUser.role === UserRole.WORKER) {
      where.workerId = currentUser.id;
    } else if (workerId) {
      where.workerId = workerId;
    }

    if (status) where.status = status;

    const submissions = await this.submissionsRepository.find({
      where,
      relations: { campaign: true, worker: true, group: true },
      order: { submittedAt: 'DESC' },
    });
    return submissions.map((submission) => this.toResponse(submission, currentUser.role));
  }

  async create(currentUser: RequestUser, dto: CreateSubmissionDto): Promise<SubmissionResponse> {
    await this.workerPerformanceService.requireNotFlagged(currentUser.id);
    await this.groupsService.enforceCooldownAvailability(currentUser.id, dto.campaignId, dto.groupId);

    const campaign = await this.campaignsService.findEntityById(dto.campaignId);
    this.validateCampaignAvailability(campaign.status, campaign.startDate, campaign.endDate);

    const group = await this.groupsService.findEntityById(dto.groupId);
    const assignedMediaVariant = this.campaignsService.pickRandomMediaVariant(campaign) as CampaignMediaVariant | null;
    const verificationSettings = this.getVerificationSettings(campaign);
    const { proofUrl, facebookPostUrl, submittedGroupName } = this.validateSubmissionInputs(dto, group.name, verificationSettings);

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
      : this.getDefaultVerificationResult();
    const fraud = await this.calculateFraudRisk(currentUser.id, dto.campaignId, dto.groupId, verification);
    const { status, reviewNote } = this.determineSubmissionStatus(verificationSettings, verification, fraud);

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
      await this.handleApprovedSubmission(saved, currentUser.id);
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

    return this.toResponse(withWorker as Submission, currentUser.role);
  }

  async review(id: number, decision: ReviewDecision, note?: string, actorId?: number): Promise<SubmissionResponse> {
    const submission = await this.findSubmissionById(id);

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

    return this.toResponse(saved, UserRole.ADMIN);
  }

  private getVerificationSettings(campaign: {
    screenshotRequired: boolean;
    facebookPostUrlRequired: boolean;
    groupNameRequired: boolean;
    manualReviewRequired: boolean;
    aiVerificationEnabled: boolean;
    autoApprovalEnabled: boolean;
  }): SubmissionVerificationSettings {
    return {
      screenshotRequired: campaign.screenshotRequired,
      facebookPostUrlRequired: campaign.facebookPostUrlRequired,
      groupNameRequired: campaign.groupNameRequired,
      manualReviewRequired: campaign.manualReviewRequired,
      aiVerificationEnabled: campaign.aiVerificationEnabled,
      autoApprovalEnabled: campaign.autoApprovalEnabled,
    };
  }

  private validateCampaignAvailability(status: CampaignStatus, startDate: Date, endDate: Date): void {
    if (status !== CampaignStatus.ACTIVE) {
      throw new BadRequestException('Campaign is not active');
    }

    const now = Date.now();
    if (startDate.getTime() > now) {
      throw new BadRequestException('Campaign has not started yet');
    }
    if (endDate.getTime() < now) {
      throw new BadRequestException('Campaign has already ended');
    }
  }

  private validateSubmissionInputs(
    dto: CreateSubmissionDto,
    expectedGroupName: string,
    verificationSettings: SubmissionVerificationSettings,
  ): { proofUrl: string | null; facebookPostUrl: string | null; submittedGroupName: string | null } {
    const proofUrl = trimToNull(dto.proofUrl);
    const facebookPostUrl = trimToNull(dto.facebookPostUrl);
    const submittedGroupName = trimToNull(dto.groupName);
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
      if (normalizeComparableText(submittedGroupName) !== normalizeComparableText(expectedGroupName)) {
        throw new BadRequestException('Group name does not match the selected group');
      }
    }

    return { proofUrl, facebookPostUrl, submittedGroupName };
  }

  private getDefaultVerificationResult(): PreReviewCheckResult {
    return {
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
  }

  private determineSubmissionStatus(
    verificationSettings: SubmissionVerificationSettings,
    verification: PreReviewCheckResult,
    fraud: FraudRiskAssessment,
  ): SubmissionStatusDecision {
    if (verificationSettings.manualReviewRequired) {
      return {
        status: SubmissionStatus.MANUAL_REVIEW,
        reviewNote: 'Manual review required by campaign settings.',
      };
    }

    if (verificationSettings.aiVerificationEnabled) {
      if (verification.duplicateProofDetected || verification.duplicateUrlDetected || fraud.flaggedForFraud) {
        return {
          status: SubmissionStatus.MANUAL_REVIEW,
          reviewNote: fraud.flaggedForFraud
            ? `Fraud risk score ${fraud.fraudRiskScore}. Manual review required.`
            : 'Duplicate risk detected. Manual review required.',
        };
      }

      if (!verification.aiVerificationAvailable) {
        return {
          status: SubmissionStatus.MANUAL_REVIEW,
          reviewNote: 'AI verification service unavailable. Sent to manual review.',
        };
      }

      if (verification.aiAutoApproveRecommended) {
        return {
          status: SubmissionStatus.APPROVED,
          reviewNote: `Auto-approved by AI verification (confidence ${Math.round(verification.confidence * 100)}%).`,
        };
      }

      return {
        status: SubmissionStatus.MANUAL_REVIEW,
        reviewNote: `AI confidence ${Math.round(verification.confidence * 100)}% is below auto-approval threshold.`,
      };
    }

    if (verificationSettings.autoApprovalEnabled) {
      return {
        status: SubmissionStatus.APPROVED,
        reviewNote: 'Auto-approved by campaign settings.',
      };
    }

    return {
      status: SubmissionStatus.PENDING,
      reviewNote: null,
    };
  }

  private async handleApprovedSubmission(submission: Submission, workerId: number): Promise<void> {
    submission.reviewedAt = new Date();
    await this.submissionsRepository.save(submission);
    await this.walletService.approvePendingReward(workerId, submission.rewardMinor);
    await this.campaignsService.recordApprovedSpend(submission.campaignId, submission.rewardMinor);
    await this.groupsService.registerApprovedSubmission(workerId, submission.campaignId, submission.groupId);
    await this.auditLogsService.record({
      action: 'submission.review.approved',
      resourceType: 'Submission',
      resourceId: String(submission.id),
      metadata: { campaignId: submission.campaignId, workerId: submission.workerId, groupId: submission.groupId },
    });
    this.eventEmitter.emit('submission.reviewed', {
      submissionId: submission.id,
      workerId: submission.workerId,
      campaignId: submission.campaignId,
      status: submission.status,
      note: submission.reviewNote,
    });
  }

  private async findSubmissionById(id: number): Promise<Submission> {
    const submission = await this.submissionsRepository.findOne({
      where: { id },
      relations: { campaign: true, worker: true, group: true },
    });
    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    return submission;
  }

  private async calculateFraudRisk(
    workerId: number,
    campaignId: number,
    groupId: number,
    verification: { duplicateProofDetected: boolean; duplicateUrlDetected: boolean },
  ): Promise<FraudRiskAssessment> {
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
  }): Promise<PreReviewCheckResult> {
    const { duplicateProofDetected, duplicateUrlDetected } = await this.checkDuplicateProofs(
      params.proofUrl,
      params.caption,
      params.groupId,
      params.campaignId,
    );

    const aiVerification = params.aiVerificationEnabled
      ? await this.submissionAiVerificationService.verifyScreenshot({
          proofUrl: await this.getVerifiableProofUrl(params.proofUrl),
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

    const confidence = this.calculateVerificationConfidence(
      params.aiVerificationEnabled,
      aiVerification,
      duplicateProofDetected,
      duplicateUrlDetected,
    );

    const threshold = this.submissionAiVerificationService.getAutoApproveThreshold();
    const aiAutoApproveRecommended = params.aiVerificationEnabled && aiVerification.available && confidence >= threshold;

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
      explanation: this.buildVerificationExplanation(params.aiVerificationEnabled, aiVerification, duplicateProofDetected, duplicateUrlDetected, confidence),
    };
  }

  private async getVerifiableProofUrl(proofUrl: string): Promise<string> {
    try {
      return await this.storageService.createSignedReadUrl(proofUrl);
    } catch {
      return proofUrl;
    }
  }

  private async checkDuplicateProofs(
    proofUrl: string,
    caption: string,
    groupId: number,
    campaignId: number,
  ): Promise<{ duplicateProofDetected: boolean; duplicateUrlDetected: boolean }> {
    const normalizedProof = normalizeComparableText(proofUrl);
    const normalizedCaption = normalizeComparableText(caption);
    const duplicateUrlDetected =
      (await this.submissionsRepository.count({
        where: { proofUrl: proofUrl.trim() },
      })) > 0;

    const candidateSubmissions = await this.submissionsRepository.find({
      where: { groupId, campaignId },
      take: 50,
      order: { submittedAt: 'DESC' },
    });

    const duplicateProofDetected = candidateSubmissions.some((existing) => {
      const existingProof = normalizeComparableText(existing.proofUrl);
      const existingCaption = normalizeComparableText(existing.caption);

      if (existingProof && existingProof === normalizedProof) {
        return true;
      }

      if (!existingCaption || !normalizedCaption) {
        return false;
      }

      return this.calculateJaccardSimilarity(existingCaption, normalizedCaption) >= 0.92;
    });

    return { duplicateProofDetected, duplicateUrlDetected };
  }

  private calculateVerificationConfidence(
    aiVerificationEnabled: boolean,
    aiVerification: {
      available: boolean;
      screenshotVisible: boolean;
      ocrText: string;
      captionMatch: boolean;
      imageMatch: boolean;
      groupNameMatch: boolean;
      dateVisible: boolean;
      timeVisible: boolean;
      confidence: number;
    },
    duplicateProofDetected: boolean,
    duplicateUrlDetected: boolean,
  ): number {
    let confidence = 0.75;
    if (aiVerificationEnabled && aiVerification.available) {
      const weightedScore =
        (aiVerification.screenshotVisible ? 0.15 : 0) +
        (aiVerification.ocrText.length > 0 ? 0.1 : 0) +
        (aiVerification.captionMatch ? 0.2 : 0) +
        (aiVerification.imageMatch ? 0.2 : 0) +
        (aiVerification.groupNameMatch ? 0.15 : 0) +
        (aiVerification.dateVisible ? 0.1 : 0) +
        (aiVerification.timeVisible ? 0.1 : 0);
      confidence = Math.max(confidence, Number((weightedScore * 0.9 + aiVerification.confidence * 0.1).toFixed(2)));
    } else if (aiVerificationEnabled && !aiVerification.available) {
      confidence = 0.35;
    }

    if (duplicateProofDetected) confidence -= 0.4;
    if (duplicateUrlDetected) confidence -= 0.3;
    return Math.max(0, Math.min(1, Number(confidence.toFixed(2))));
  }

  private buildVerificationExplanation(
    aiVerificationEnabled: boolean,
    aiVerification: {
      available: boolean;
      screenshotVisible: boolean;
      ocrText: string;
      captionMatch: boolean;
      imageMatch: boolean;
      groupNameMatch: boolean;
      dateVisible: boolean;
      timeVisible: boolean;
      notes: string;
    },
    duplicateProofDetected: boolean,
    duplicateUrlDetected: boolean,
    confidence: number,
  ): string {
    const explanationParts = [
      duplicateProofDetected ? 'Similar proof content detected' : 'Proof appears unique in recent campaign-group history',
      duplicateUrlDetected ? 'Proof URL already submitted earlier' : 'Proof URL not seen before',
      aiVerificationEnabled
        ? aiVerification.available
          ? `AI checks: screenshot=${aiVerification.screenshotVisible}, ocrText=${aiVerification.ocrText.length > 0}, captionMatch=${aiVerification.captionMatch}, imageMatch=${aiVerification.imageMatch}, groupNameMatch=${aiVerification.groupNameMatch}, dateVisible=${aiVerification.dateVisible}, timeVisible=${aiVerification.timeVisible}`
          : `AI checks unavailable: ${this.sanitizeVerificationMessage(aiVerification.notes)}`
        : 'AI verification disabled',
      `Confidence ${Math.round(confidence * 100)}%`,
    ];

    return explanationParts.join(' | ');
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

  private toResponse(submission: Submission, viewerRole: UserRole): SubmissionResponse {
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
      reviewNote: this.getVisibleReviewNote(submission.reviewNote, viewerRole),
      verificationConfidence: submission.verificationConfidence,
      verificationExplanation: this.getVisibleVerificationExplanation(submission.verificationExplanation, viewerRole),
      duplicateProofDetected: submission.duplicateProofDetected,
      duplicateUrlDetected: submission.duplicateUrlDetected,
      fraudRiskScore: viewerRole === UserRole.ADMIN ? submission.fraudRiskScore : 0,
      flaggedForFraud: viewerRole === UserRole.ADMIN ? submission.flaggedForFraud : false,
      fraudSignals: viewerRole === UserRole.ADMIN ? (submission.fraudSignals ?? {}) : {},
    };
  }

  private getVisibleReviewNote(reviewNote: string | null | undefined, viewerRole: UserRole): string {
    const note = (reviewNote ?? '').trim();
    if (!note) {
      return '';
    }

    if (viewerRole === UserRole.ADMIN) {
      return note;
    }

    const normalized = note.toLowerCase();
    if (normalized.includes('manual review') || normalized.includes('review required')) {
      return 'Your submission is under review.';
    }
    if (normalized.includes('auto-approved')) {
      return 'Your submission has been approved.';
    }
    if (normalized.includes('rejected')) {
      return 'Your submission was not approved. Please review the requirements and try again.';
    }
    if (normalized.includes('resubmission')) {
      return 'Please update your submission and resubmit it.';
    }

    return 'Your submission is being reviewed.';
  }

  private getVisibleVerificationExplanation(verificationExplanation: string | null | undefined, viewerRole: UserRole): string {
    const explanation = (verificationExplanation ?? '').trim();
    if (!explanation) {
      return '';
    }

    if (viewerRole === UserRole.ADMIN) {
      return this.sanitizeVerificationMessage(explanation);
    }

    const normalized = explanation.toLowerCase();
    if (normalized.includes('ai checks unavailable') || normalized.includes('ai verification')) {
      return 'AI verification could not be completed. Please try again later.';
    }
    if (normalized.includes('similar proof content detected')) {
      return 'The submitted proof appears similar to a prior submission.';
    }
    if (normalized.includes('proof url already submitted earlier')) {
      return 'The submitted proof appears to have been used before.';
    }
    if (normalized.includes('proof appears unique')) {
      return 'The submitted proof appears unique and is under review.';
    }

    return 'The submission is being reviewed.';
  }

  private sanitizeVerificationMessage(message: string | null | undefined): string {
    const normalized = (message ?? '').trim();
    if (!normalized) {
      return '';
    }

    const lower = normalized.toLowerCase();
    if (lower.includes('openai api error') || lower.includes('api error') || lower.includes('failed:')) {
      return 'AI verification service could not complete review. Please try again later.';
    }
    if (lower.includes('api key') || lower.includes('authentication') || lower.includes('rate limit')) {
      return 'AI verification service is temporarily unavailable.';
    }

    return normalized;
  }
}

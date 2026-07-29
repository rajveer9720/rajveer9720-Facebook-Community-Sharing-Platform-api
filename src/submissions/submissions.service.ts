import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission } from './submission.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { SubmissionResponse } from './submission.response';
import { ReviewDecision, SubmissionStatus } from '../common/enums';
import { CampaignsService } from '../campaigns/campaigns.service';
import { GroupsService } from '../groups/groups.service';
import { WalletService } from '../wallet/wallet.service';
import { RequestUser } from '../common/types/jwt-payload';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission) private readonly submissionsRepository: Repository<Submission>,
    private readonly campaignsService: CampaignsService,
    private readonly groupsService: GroupsService,
    private readonly walletService: WalletService,
  ) {}

  async findAll(workerId?: string, status?: SubmissionStatus): Promise<SubmissionResponse[]> {
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
    const campaign = await this.campaignsService.findEntityById(dto.campaignId);
    const group = await this.groupsService.findEntityById(dto.groupId);

    const submission = this.submissionsRepository.create({
      campaignId: campaign.id,
      campaign,
      workerId: currentUser.id,
      groupId: group.id,
      group,
      status: SubmissionStatus.PENDING,
      proofUrl: dto.proofUrl,
      caption: dto.caption,
      rewardMinor: campaign.rewardPerPostMinor,
      reviewedAt: null,
      reviewNote: null,
    });
    const saved = await this.submissionsRepository.save(submission);

    await this.walletService.registerPendingReward(currentUser.id, saved.rewardMinor);

    const withWorker = await this.submissionsRepository.findOne({
      where: { id: saved.id },
      relations: { campaign: true, worker: true, group: true },
    });
    return this.toResponse(withWorker as Submission);
  }

  async review(id: string, decision: ReviewDecision, note?: string): Promise<SubmissionResponse> {
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
    } else if (decision === ReviewDecision.REJECT) {
      submission.status = SubmissionStatus.REJECTED;
      await this.walletService.rejectPendingReward(submission.workerId, submission.rewardMinor);
    } else {
      submission.status = SubmissionStatus.PENDING;
    }

    const saved = await this.submissionsRepository.save(submission);
    return this.toResponse(saved);
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
      caption: submission.caption,
      rewardMinor: submission.rewardMinor,
      submittedAt: submission.submittedAt.toISOString(),
      reviewedAt: submission.reviewedAt ? submission.reviewedAt.toISOString() : null,
      reviewNote: submission.reviewNote,
    };
  }
}

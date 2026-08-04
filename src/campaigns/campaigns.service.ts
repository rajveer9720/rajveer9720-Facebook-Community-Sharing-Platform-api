import { BadRequestException, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCampaignDto, UpdateCampaignDto } from '../dto/campaigns.dto';
import { Campaign } from './campaign.entity';
import { CampaignResponse } from '../interfaces/campaigns.interface';
import { CampaignStatus } from '../common/enums';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { WorkersService } from '../workers/workers.service';
import { GcsStorageService } from '../storage/gcs-storage.service';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(Campaign) private readonly campaignsRepository: Repository<Campaign>,
    private readonly auditLogsService: AuditLogsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly workersService: WorkersService,
    private readonly storageService: GcsStorageService,
  ) {}

  async uploadMedia(adminId: number, file: Express.Multer.File): Promise<{ mediaUrl: string; objectKey: string }> {
    if (!file) {
      throw new BadRequestException('Media file is required');
    }
    return this.storageService.uploadCampaignMedia(adminId, file);
  }

  async getMediaDownload(objectKeyOrUrl: string) {
    return this.storageService.downloadFile(objectKeyOrUrl);
  }

  async getMediaSignedUrl(objectKeyOrUrl: string): Promise<{ signedUrl: string; expiresAt: string }> {
    const expirationSeconds = 3600;
    const signedUrl = await this.storageService.createSignedReadUrl(objectKeyOrUrl, expirationSeconds);
    const expiresAt = new Date(Date.now() + expirationSeconds * 1000).toISOString();
    return { signedUrl, expiresAt };
  }

  async findAll(status?: CampaignStatus): Promise<CampaignResponse[]> {
    const campaigns = await this.campaignsRepository.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
    await this.emitEndingSoonCampaignNotifications(campaigns);
    return campaigns.map((campaign) => this.toResponse(campaign));
  }

  async findById(id: number): Promise<CampaignResponse> {
    const campaign = await this.campaignsRepository.findOne({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return this.toResponse(campaign);
  }

  async create(dto: CreateCampaignDto, actorId?: number): Promise<CampaignResponse> {
    const campaign = this.campaignsRepository.create({
      name: dto.name,
      category: dto.category,
      priority: dto.priority,
      status: CampaignStatus.ACTIVE,
      instructions: dto.instructions,
      mediaVariants: dto.mediaVariants,
      screenshotRequired: dto.screenshotRequired,
      facebookPostUrlRequired: dto.facebookPostUrlRequired,
      groupNameRequired: dto.groupNameRequired,
      manualReviewRequired: dto.manualReviewRequired,
      aiVerificationEnabled: dto.aiVerificationEnabled,
      autoApprovalEnabled: dto.autoApprovalEnabled,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      budgetMinor: dto.budgetMinor,
      spentMinor: 0,
      rewardPerPostMinor: dto.rewardPerPostMinor,
      currency: 'GBP',
      maximumWorkers: dto.maximumWorkers,
      maximumPostsPerWorker: dto.maximumPostsPerWorker,
      dailyPostingLimit: dto.dailyPostingLimit,
      workersJoined: 0,
      archivedAt: null,
      endingSoonNotifiedAt: null,
    });
    const saved = await this.campaignsRepository.save(campaign);
    await this.auditLogsService.record({
      actorId,
      action: 'campaign.create',
      resourceType: 'Campaign',
      resourceId: saved.id,
      metadata: { name: saved.name, category: saved.category, status: saved.status },
    });

    const workers = await this.workersService.findAll();
    this.eventEmitter.emit('campaign.created', {
      campaignId: saved.id,
      campaignName: saved.name,
      workerIds: workers.map((worker) => worker.id),
    });

    return this.toResponse(saved);
  }

  async update(id: number, dto: UpdateCampaignDto, actorId?: number): Promise<CampaignResponse> {
    const campaign = await this.findCampaignEntity(id);

    if (dto.name !== undefined) campaign.name = dto.name;
    if (dto.category !== undefined) campaign.category = dto.category;
    if (dto.priority !== undefined) campaign.priority = dto.priority;
    if (dto.startDate !== undefined) campaign.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) campaign.endDate = new Date(dto.endDate);
    if (dto.budgetMinor !== undefined) campaign.budgetMinor = dto.budgetMinor;
    if (dto.rewardPerPostMinor !== undefined) campaign.rewardPerPostMinor = dto.rewardPerPostMinor;
    if (dto.maximumWorkers !== undefined) campaign.maximumWorkers = dto.maximumWorkers;
    if (dto.maximumPostsPerWorker !== undefined) campaign.maximumPostsPerWorker = dto.maximumPostsPerWorker;
    if (dto.dailyPostingLimit !== undefined) campaign.dailyPostingLimit = dto.dailyPostingLimit;
    if (dto.instructions !== undefined) campaign.instructions = dto.instructions;
    if (dto.mediaVariants !== undefined) campaign.mediaVariants = dto.mediaVariants;
    if (dto.screenshotRequired !== undefined) campaign.screenshotRequired = dto.screenshotRequired;
    if (dto.facebookPostUrlRequired !== undefined) campaign.facebookPostUrlRequired = dto.facebookPostUrlRequired;
    if (dto.groupNameRequired !== undefined) campaign.groupNameRequired = dto.groupNameRequired;
    if (dto.manualReviewRequired !== undefined) campaign.manualReviewRequired = dto.manualReviewRequired;
    if (dto.aiVerificationEnabled !== undefined) campaign.aiVerificationEnabled = dto.aiVerificationEnabled;
    if (dto.autoApprovalEnabled !== undefined) campaign.autoApprovalEnabled = dto.autoApprovalEnabled;

    if (dto.endDate !== undefined && campaign.endDate.getTime() <= campaign.startDate.getTime()) {
      throw new BadRequestException('End date must be after the start date');
    }

    const saved = await this.campaignsRepository.save(campaign);
    await this.auditLogsService.record({
      actorId,
      action: 'campaign.update',
      resourceType: 'Campaign',
      resourceId: saved.id,
      metadata: { changed: Object.keys(dto) },
    });
    return this.toResponse(saved);
  }

  async activate(id: number, actorId?: number): Promise<CampaignResponse> {
    const campaign = await this.findCampaignEntity(id);
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new ConflictException('Only draft campaigns can be activated');
    }

    campaign.status = CampaignStatus.ACTIVE;
    const saved = await this.campaignsRepository.save(campaign);
    await this.auditLogsService.record({ actorId, action: 'campaign.activate', resourceType: 'Campaign', resourceId: saved.id });
    return this.toResponse(saved);
  }

  async pause(id: number, actorId?: number): Promise<CampaignResponse> {
    const campaign = await this.findCampaignEntity(id);
    if (campaign.status !== CampaignStatus.ACTIVE) {
      throw new ConflictException('Only active campaigns can be paused');
    }

    campaign.status = CampaignStatus.PAUSED;
    const saved = await this.campaignsRepository.save(campaign);
    await this.auditLogsService.record({ actorId, action: 'campaign.pause', resourceType: 'Campaign', resourceId: saved.id });
    return this.toResponse(saved);
  }

  async resume(id: number, actorId?: number): Promise<CampaignResponse> {
    const campaign = await this.findCampaignEntity(id);
    if (campaign.status !== CampaignStatus.PAUSED) {
      throw new ConflictException('Only paused campaigns can be resumed');
    }
    if (campaign.archivedAt) {
      throw new ConflictException('Archived campaigns cannot be resumed');
    }

    campaign.status = CampaignStatus.ACTIVE;
    const saved = await this.campaignsRepository.save(campaign);
    await this.auditLogsService.record({ actorId, action: 'campaign.resume', resourceType: 'Campaign', resourceId: saved.id });
    return this.toResponse(saved);
  }

  async duplicate(id: number, actorId?: number): Promise<CampaignResponse> {
    const campaign = await this.findCampaignEntity(id);
    const duplicateCampaign = this.campaignsRepository.create({
      name: `${campaign.name} (Copy)`,
      category: campaign.category,
      priority: campaign.priority,
      status: CampaignStatus.DRAFT,
      instructions: campaign.instructions,
      screenshotRequired: campaign.screenshotRequired,
      facebookPostUrlRequired: campaign.facebookPostUrlRequired,
      groupNameRequired: campaign.groupNameRequired,
      manualReviewRequired: campaign.manualReviewRequired,
      aiVerificationEnabled: campaign.aiVerificationEnabled,
      autoApprovalEnabled: campaign.autoApprovalEnabled,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      budgetMinor: campaign.budgetMinor,
      spentMinor: 0,
      rewardPerPostMinor: campaign.rewardPerPostMinor,
      currency: campaign.currency,
      maximumWorkers: campaign.maximumWorkers,
      maximumPostsPerWorker: campaign.maximumPostsPerWorker,
      dailyPostingLimit: campaign.dailyPostingLimit,
      workersJoined: 0,
      archivedAt: null,
      endingSoonNotifiedAt: null,
    });
    const saved = await this.campaignsRepository.save(duplicateCampaign);
    await this.auditLogsService.record({ actorId, action: 'campaign.duplicate', resourceType: 'Campaign', resourceId: saved.id, metadata: { sourceCampaignId: id } });
    return this.toResponse(saved);
  }

  async archive(id: number, actorId?: number): Promise<CampaignResponse> {
    const campaign = await this.findCampaignEntity(id);
    campaign.status = CampaignStatus.ARCHIVED;
    campaign.archivedAt = new Date();
    const saved = await this.campaignsRepository.save(campaign);
    await this.auditLogsService.record({ actorId, action: 'campaign.archive', resourceType: 'Campaign', resourceId: saved.id });
    return this.toResponse(saved);
  }

  async recordApprovedSpend(id: number, amountMinor: number): Promise<CampaignResponse> {
    const campaign = await this.findCampaignEntity(id);
    campaign.spentMinor += amountMinor;

    if (campaign.spentMinor >= campaign.budgetMinor) {
      campaign.status = CampaignStatus.COMPLETED;
    }

    return this.toResponse(await this.campaignsRepository.save(campaign));
  }

  async findEntityById(id: number): Promise<Campaign> {
    return this.findCampaignEntity(id);
  }

  private toResponse(campaign: Campaign): CampaignResponse {
    return {
      id: campaign.id,
      name: campaign.name,
      category: campaign.category,
      priority: campaign.priority,
      status: campaign.status,
      instructions: campaign.instructions,
      mediaVariants: campaign.mediaVariants ?? [],
      verificationSettings: {
        screenshotRequired: campaign.screenshotRequired,
        facebookPostUrlRequired: campaign.facebookPostUrlRequired,
        groupNameRequired: campaign.groupNameRequired,
        manualReviewRequired: campaign.manualReviewRequired,
        aiVerificationEnabled: campaign.aiVerificationEnabled,
        autoApprovalEnabled: campaign.autoApprovalEnabled,
      },
      startDate: campaign.startDate.toISOString(),
      endDate: campaign.endDate.toISOString(),
      budgetMinor: campaign.budgetMinor,
      spentMinor: campaign.spentMinor,
      remainingBudgetMinor: Math.max(0, campaign.budgetMinor - campaign.spentMinor),
      rewardPerPostMinor: campaign.rewardPerPostMinor,
      currency: campaign.currency,
      maximumWorkers: campaign.maximumWorkers,
      maximumPostsPerWorker: campaign.maximumPostsPerWorker,
      dailyPostingLimit: campaign.dailyPostingLimit,
      workersJoined: campaign.workersJoined,
      archivedAt: campaign.archivedAt ? campaign.archivedAt.toISOString() : null,
      endingSoonNotifiedAt: campaign.endingSoonNotifiedAt ? campaign.endingSoonNotifiedAt.toISOString() : null,
      createdAt: campaign.createdAt.toISOString(),
    };
  }

  private async emitEndingSoonCampaignNotifications(campaigns: Campaign[]): Promise<void> {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const workers = await this.workersService.findAll();

    const toNotify = campaigns.filter((campaign) => {
      if (campaign.status !== CampaignStatus.ACTIVE) return false;
      if (campaign.endingSoonNotifiedAt) return false;
      const timeUntilEnd = campaign.endDate.getTime() - now;
      return timeUntilEnd > 0 && timeUntilEnd <= oneDayMs;
    });

    if (toNotify.length === 0 || workers.length === 0) {
      return;
    }

    for (const campaign of toNotify) {
      campaign.endingSoonNotifiedAt = new Date();
      this.eventEmitter.emit('campaign.ending_soon', {
        campaignId: campaign.id,
        campaignName: campaign.name,
        endDate: campaign.endDate.toISOString(),
        workerIds: workers.map((worker) => worker.id),
      });
    }

    await this.campaignsRepository.save(toNotify);
  }

  private async findCampaignEntity(id: number): Promise<Campaign> {
    const campaign = await this.campaignsRepository.findOne({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return campaign;
  }

  pickRandomMediaVariant(campaign: Campaign): { mediaUrl: string; mediaType: 'IMAGE' | 'VIDEO'; caption: string } | null {
    const variants = campaign.mediaVariants ?? [];
    if (variants.length === 0) {
      return null;
    }

    const index = Math.floor(Math.random() * variants.length);
    return variants[index] ?? null;
  }
}

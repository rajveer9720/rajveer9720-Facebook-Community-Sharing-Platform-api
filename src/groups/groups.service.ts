import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { FacebookGroup } from './facebook-group.entity';
import { WorkerGroupLibraryEntry } from './worker-group-library-entry.entity';
import { CreateGroupDiscoveryDto } from './dto/create-group-discovery.dto';
import { GroupCoverageStatsResponse, GroupRecommendationResponse, GroupResponse, WorkerGroupLibraryEntryResponse } from './group.response';
import { RecommendGroupsDto } from './dto/recommend-groups.dto';
import { ModerateGroupDto } from './dto/moderate-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { CampaignGroupAssignment } from './campaign-group-assignment.entity';
import { GroupStatus } from '../common/enums';
import { CampaignsService } from '../campaigns/campaigns.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(FacebookGroup) private readonly groupsRepository: Repository<FacebookGroup>,
    @InjectRepository(WorkerGroupLibraryEntry)
    private readonly libraryRepository: Repository<WorkerGroupLibraryEntry>,
    @InjectRepository(CampaignGroupAssignment)
    private readonly assignmentsRepository: Repository<CampaignGroupAssignment>,
    private readonly campaignsService: CampaignsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async findAll(status?: GroupStatus): Promise<GroupResponse[]> {
    const groups = await this.groupsRepository.find({ where: status ? { status } : {} });
    return groups.map((group) => this.toGroupResponse(group));
  }

  async coverage(): Promise<GroupCoverageStatsResponse> {
    const approvedGroups = await this.groupsRepository.count({ where: { status: GroupStatus.APPROVED } });
    const pendingDiscoveries = await this.groupsRepository.count({ where: { status: GroupStatus.PENDING } });
    return {
      approvedGroups,
      pendingDiscoveries,
      uniqueGroupsCovered: approvedGroups,
      duplicateGroupRate: 0,
    };
  }

  async libraryForWorker(workerId: number): Promise<WorkerGroupLibraryEntryResponse[]> {
    const entries = await this.libraryRepository.find({
      where: { workerId },
      relations: { group: true },
    });
    return entries.map((entry) => ({
      id: entry.id,
      groupId: entry.groupId,
      group: this.toGroupResponse(entry.group),
      timesUsed: entry.timesUsed,
      lastPostedAt: entry.lastPostedAt ? entry.lastPostedAt.toISOString() : null,
      availableAt: entry.availableAt ? entry.availableAt.toISOString() : null,
    }));
  }

  async findEntityById(id: number): Promise<FacebookGroup> {
    const group = await this.groupsRepository.findOne({ where: { id } });
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    return group;
  }

  async create(dto: CreateGroupDiscoveryDto): Promise<GroupResponse> {
    const group = this.groupsRepository.create({
      name: dto.name,
      category: dto.category,
      country: dto.country,
      url: dto.url ?? null,
      language: dto.language ?? null,
      privacyType: dto.privacyType ?? null,
      qualityScore: 0,
      engagementScore: 0,
      spamScore: 0,
      blacklisted: false,
      cooldownHours: 48,
      lastWorkerId: null,
      lastCampaignId: null,
      status: GroupStatus.PENDING,
      memberCount: dto.memberCount,
    });
    const saved = await this.groupsRepository.save(group);
    return this.toGroupResponse(saved);
  }

  async recommendForWorker(workerId: number, dto: RecommendGroupsDto): Promise<GroupRecommendationResponse[]> {
    const campaign = await this.campaignsService.findEntityById(dto.campaignId);
    const limit = dto.limit ?? 10;
    const now = new Date();

    const activeAssignments = await this.assignmentsRepository.find({
      where: {
        campaignId: campaign.id,
        cooldownUntil: MoreThan(now),
      },
    });

    const blockedGroupIds = new Set(activeAssignments.map((assignment) => assignment.groupId));
    const workerLibraryEntries = await this.libraryRepository.find({ where: { workerId } });
    const libraryByGroupId = new Map(workerLibraryEntries.map((entry) => [entry.groupId, entry]));

    const groups = await this.groupsRepository.find({
      where: { status: GroupStatus.APPROVED, blacklisted: false },
    });

    const eligibleGroups = groups.filter((group) => {
      if (blockedGroupIds.has(group.id)) {
        return false;
      }
      if (group.category.toLowerCase() !== String(campaign.category).toLowerCase()) {
        return false;
      }
      if (dto.country && group.country.toLowerCase() !== dto.country.toLowerCase()) {
        return false;
      }
      if (dto.language && group.language && group.language.toLowerCase() !== dto.language.toLowerCase()) {
        return false;
      }

      const libraryEntry = libraryByGroupId.get(group.id);
      if (libraryEntry?.availableAt && libraryEntry.availableAt.getTime() > now.getTime()) {
        return false;
      }
      return true;
    });

    eligibleGroups.sort((a, b) => this.computeGroupScore(b, libraryByGroupId.get(b.id)) - this.computeGroupScore(a, libraryByGroupId.get(a.id)));
    const selectedGroups = eligibleGroups.slice(0, limit);

    const assignmentsToSave = selectedGroups.map((group) =>
      this.assignmentsRepository.create({
        campaignId: campaign.id,
        groupId: group.id,
        workerId,
        cooldownUntil: new Date(now.getTime() + group.cooldownHours * 60 * 60 * 1000),
        consumedAt: null,
      }),
    );

    const savedAssignments = await this.assignmentsRepository.save(assignmentsToSave);
    const assignmentMap = new Map(savedAssignments.map((assignment) => [assignment.groupId, assignment]));

    for (const group of selectedGroups) {
      group.lastWorkerId = workerId;
      group.lastCampaignId = campaign.id;
    }
    await this.groupsRepository.save(selectedGroups);

    return selectedGroups.map((group) => {
      const assignment = assignmentMap.get(group.id);
      return {
        assignmentId: Number(assignment?.id ?? 0),
        campaignId: campaign.id,
        cooldownUntil: (assignment?.cooldownUntil ?? now).toISOString(),
        group: this.toGroupResponse(group),
      };
    });
  }

  async enforceCooldownAvailability(workerId: number, campaignId: number, groupId: number): Promise<void> {
    const now = new Date();
    const active = await this.assignmentsRepository.findOne({
      where: {
        campaignId,
        groupId,
        cooldownUntil: MoreThan(now),
      },
      order: { assignedAt: 'DESC' },
    });

    if (active && active.workerId !== workerId) {
      throw new BadRequestException('This group is currently on cooldown for the selected campaign');
    }
  }

  async registerApprovedSubmission(workerId: number, campaignId: number, groupId: number): Promise<void> {
    const group = await this.findEntityById(groupId);
    const now = new Date();
    const cooldownUntil = new Date(now.getTime() + group.cooldownHours * 60 * 60 * 1000);

    let entry = await this.libraryRepository.findOne({ where: { workerId, groupId } });
    if (!entry) {
      entry = this.libraryRepository.create({
        workerId,
        groupId,
        timesUsed: 1,
        lastPostedAt: now,
        availableAt: cooldownUntil,
      });
    } else {
      entry.timesUsed += 1;
      entry.lastPostedAt = now;
      entry.availableAt = cooldownUntil;
    }
    await this.libraryRepository.save(entry);

    group.lastWorkerId = workerId;
    group.lastCampaignId = campaignId;
    await this.groupsRepository.save(group);

    const assignment = await this.assignmentsRepository.findOne({
      where: { workerId, campaignId, groupId },
      order: { assignedAt: 'DESC' },
    });
    if (assignment && !assignment.consumedAt) {
      assignment.consumedAt = now;
      await this.assignmentsRepository.save(assignment);
    }
  }

  async moderate(id: number, dto: ModerateGroupDto, actorId?: number): Promise<GroupResponse> {
    const group = await this.findEntityById(id);

    if (dto.status !== undefined) group.status = dto.status;
    if (dto.blacklisted !== undefined) group.blacklisted = dto.blacklisted;
    if (dto.qualityScore !== undefined) group.qualityScore = dto.qualityScore;
    if (dto.engagementScore !== undefined) group.engagementScore = dto.engagementScore;
    if (dto.spamScore !== undefined) group.spamScore = dto.spamScore;
    if (dto.lastCampaignId !== undefined) group.lastCampaignId = dto.lastCampaignId;
    if (dto.lastWorkerId !== undefined) group.lastWorkerId = dto.lastWorkerId;

    const saved = await this.groupsRepository.save(group);
    await this.auditLogsService.record({
      actorId,
      action: 'group.moderate',
      resourceType: 'FacebookGroup',
      resourceId: saved.id,
      metadata: {
        status: dto.status,
        blacklisted: dto.blacklisted,
        qualityScore: dto.qualityScore,
        engagementScore: dto.engagementScore,
        spamScore: dto.spamScore,
        adminNote: dto.adminNote,
      },
    });
    return this.toGroupResponse(saved);
  }

  async update(id: number, dto: UpdateGroupDto, actorId?: number): Promise<GroupResponse> {
    const group = await this.findEntityById(id);

    if (dto.name !== undefined) group.name = dto.name;
    if (dto.category !== undefined) group.category = dto.category;
    if (dto.country !== undefined) group.country = dto.country;
    if (dto.language !== undefined) group.language = dto.language;
    if (dto.url !== undefined) group.url = dto.url;
    if (dto.privacyType !== undefined) group.privacyType = dto.privacyType;
    if (dto.memberCount !== undefined) group.memberCount = dto.memberCount;
    if (dto.cooldownHours !== undefined) group.cooldownHours = dto.cooldownHours;

    const saved = await this.groupsRepository.save(group);
    await this.auditLogsService.record({
      actorId,
      action: 'group.update',
      resourceType: 'FacebookGroup',
      resourceId: saved.id,
      metadata: {
        changed: Object.keys(dto),
      },
    });
    return this.toGroupResponse(saved);
  }

  private computeGroupScore(group: FacebookGroup, libraryEntry?: WorkerGroupLibraryEntry): number {
    let score = group.qualityScore * 2 + group.engagementScore - group.spamScore * 1.5;
    if (libraryEntry) {
      score += Math.min(20, libraryEntry.timesUsed * 2);
    }
    return score;
  }

  private toGroupResponse(group: FacebookGroup): GroupResponse {
    return {
      id: group.id,
      name: group.name,
      category: group.category,
      country: group.country,
      url: group.url,
      language: group.language,
      privacyType: group.privacyType,
      qualityScore: group.qualityScore,
      engagementScore: group.engagementScore,
      spamScore: group.spamScore,
      blacklisted: group.blacklisted,
      cooldownHours: group.cooldownHours,
      lastWorkerId: group.lastWorkerId,
      lastCampaignId: group.lastCampaignId,
      status: group.status,
      memberCount: group.memberCount,
    };
  }
}

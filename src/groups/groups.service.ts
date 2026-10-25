import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { DEFAULT_GROUP_COOLDOWN_HOURS } from '../common/constants/group.constants';
import { addHours } from '../common/utils/date.utils';
import { normalizeComparableText } from '../common/utils/string.utils';
import { CreateGroupDiscoveryDto, ModerateGroupDto, RecommendGroupsDto, UpdateGroupDto } from '../dto/groups.dto';
import { FacebookGroup } from './facebook-group.entity';
import { WorkerGroupLibraryEntry } from './worker-group-library-entry.entity';
import { GroupCoverageStatsResponse, GroupRecommendationResponse, GroupResponse, WorkerGroupLibraryEntryResponse } from '../interfaces/groups.interface';
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
      cooldownHours: DEFAULT_GROUP_COOLDOWN_HOURS,
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
    const libraryByGroupId = await this.getLibraryEntriesByGroupId(workerId);

    const groups = await this.groupsRepository.find({
      where: { status: GroupStatus.APPROVED, blacklisted: false },
    });

    const selectedGroups = this.selectRecommendedGroups(groups, blockedGroupIds, libraryByGroupId, campaign.category, dto, now, limit);
    const assignmentMap = await this.reserveAssignments(selectedGroups, campaign.id, workerId, now);
    await this.updateSelectedGroups(selectedGroups, workerId, campaign.id);

    return this.toGroupRecommendations(selectedGroups, assignmentMap, campaign.id, now);
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
    const cooldownUntil = addHours(now, group.cooldownHours);

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

    const action = dto.action?.toUpperCase();
    if (action === 'APPROVE' && dto.status === undefined) {
      group.status = GroupStatus.APPROVED;
    }
    if (action === 'REJECT' && dto.status === undefined) {
      group.status = GroupStatus.REJECTED;
    }
    if (action === 'BLACKLIST' && dto.blacklisted === undefined) {
      group.blacklisted = true;
    }
    if (action === 'UNBLACKLIST' && dto.blacklisted === undefined) {
      group.blacklisted = false;
    }

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
        action: dto.action,
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

  private async getLibraryEntriesByGroupId(workerId: number): Promise<Map<number, WorkerGroupLibraryEntry>> {
    const workerLibraryEntries = await this.libraryRepository.find({ where: { workerId } });
    return new Map(workerLibraryEntries.map((entry) => [entry.groupId, entry]));
  }

  private selectRecommendedGroups(
    groups: FacebookGroup[],
    blockedGroupIds: Set<number>,
    libraryByGroupId: Map<number, WorkerGroupLibraryEntry>,
    campaignCategory: string,
    dto: RecommendGroupsDto,
    now: Date,
    limit: number,
  ): FacebookGroup[] {
    return groups
      .filter((group) => this.isEligibleGroup(group, blockedGroupIds, libraryByGroupId, campaignCategory, dto, now))
      .sort((a, b) => this.computeGroupScore(b, libraryByGroupId.get(b.id)) - this.computeGroupScore(a, libraryByGroupId.get(a.id)))
      .slice(0, limit);
  }

  private isEligibleGroup(
    group: FacebookGroup,
    blockedGroupIds: Set<number>,
    libraryByGroupId: Map<number, WorkerGroupLibraryEntry>,
    campaignCategory: string,
    dto: RecommendGroupsDto,
    now: Date,
  ): boolean {
    if (blockedGroupIds.has(group.id)) {
      return false;
    }

    if (normalizeComparableText(group.category) !== normalizeComparableText(String(campaignCategory))) {
      return false;
    }

    if (dto.country && normalizeComparableText(group.country) !== normalizeComparableText(dto.country)) {
      return false;
    }

    if (dto.language && group.language && normalizeComparableText(group.language) !== normalizeComparableText(dto.language)) {
      return false;
    }

    const libraryEntry = libraryByGroupId.get(group.id);
    return !(libraryEntry?.availableAt && libraryEntry.availableAt.getTime() > now.getTime());
  }

  private async reserveAssignments(
    groups: FacebookGroup[],
    campaignId: number,
    workerId: number,
    now: Date,
  ): Promise<Map<number, CampaignGroupAssignment>> {
    const assignmentsToSave = groups.map((group) =>
      this.assignmentsRepository.create({
        campaignId,
        groupId: group.id,
        workerId,
        cooldownUntil: addHours(now, group.cooldownHours),
        consumedAt: null,
      }),
    );

    const savedAssignments = await this.assignmentsRepository.save(assignmentsToSave);
    return new Map(savedAssignments.map((assignment) => [assignment.groupId, assignment]));
  }

  private async updateSelectedGroups(groups: FacebookGroup[], workerId: number, campaignId: number): Promise<void> {
    for (const group of groups) {
      group.lastWorkerId = workerId;
      group.lastCampaignId = campaignId;
    }

    await this.groupsRepository.save(groups);
  }

  private toGroupRecommendations(
    groups: FacebookGroup[],
    assignmentMap: Map<number, CampaignGroupAssignment>,
    campaignId: number,
    fallbackDate: Date,
  ): GroupRecommendationResponse[] {
    return groups.map((group) => {
      const assignment = assignmentMap.get(group.id);
      return {
        assignmentId: Number(assignment?.id ?? 0),
        campaignId,
        cooldownUntil: (assignment?.cooldownUntil ?? fallbackDate).toISOString(),
        group: this.toGroupResponse(group),
      };
    });
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

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FacebookGroup } from './facebook-group.entity';
import { WorkerGroupLibraryEntry } from './worker-group-library-entry.entity';
import { CreateGroupDiscoveryDto } from './dto/create-group-discovery.dto';
import { GroupCoverageStatsResponse, GroupResponse, WorkerGroupLibraryEntryResponse } from './group.response';
import { GroupStatus } from '../common/enums';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(FacebookGroup) private readonly groupsRepository: Repository<FacebookGroup>,
    @InjectRepository(WorkerGroupLibraryEntry)
    private readonly libraryRepository: Repository<WorkerGroupLibraryEntry>,
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

  async libraryForWorker(workerId: string): Promise<WorkerGroupLibraryEntryResponse[]> {
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

  async findEntityById(id: string): Promise<FacebookGroup> {
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
      qualityScore: 0,
      cooldownHours: 48,
      status: GroupStatus.PENDING,
      memberCount: dto.memberCount,
    });
    const saved = await this.groupsRepository.save(group);
    return this.toGroupResponse(saved);
  }

  private toGroupResponse(group: FacebookGroup): GroupResponse {
    return {
      id: group.id,
      name: group.name,
      category: group.category,
      country: group.country,
      qualityScore: group.qualityScore,
      cooldownHours: group.cooldownHours,
      status: group.status,
      memberCount: group.memberCount,
    };
  }
}

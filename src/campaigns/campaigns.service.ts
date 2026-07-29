import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campaign } from './campaign.entity';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CampaignResponse } from './campaign.response';
import { CampaignStatus } from '../common/enums';

@Injectable()
export class CampaignsService {
  constructor(@InjectRepository(Campaign) private readonly campaignsRepository: Repository<Campaign>) {}

  async findAll(status?: CampaignStatus): Promise<CampaignResponse[]> {
    const campaigns = await this.campaignsRepository.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
    return campaigns.map((campaign) => this.toResponse(campaign));
  }

  async findById(id: string): Promise<CampaignResponse> {
    const campaign = await this.campaignsRepository.findOne({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return this.toResponse(campaign);
  }

  async create(dto: CreateCampaignDto): Promise<CampaignResponse> {
    const campaign = this.campaignsRepository.create({
      name: dto.name,
      category: dto.category,
      priority: dto.priority,
      status: CampaignStatus.DRAFT,
      instructions: dto.instructions,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      budgetMinor: dto.budgetMinor,
      rewardPerPostMinor: dto.rewardPerPostMinor,
      currency: 'GBP',
      maximumWorkers: dto.maximumWorkers,
      maximumPostsPerWorker: dto.maximumPostsPerWorker,
      dailyPostingLimit: dto.dailyPostingLimit,
      workersJoined: 0,
    });
    const saved = await this.campaignsRepository.save(campaign);
    return this.toResponse(saved);
  }

  async findEntityById(id: string): Promise<Campaign> {
    const campaign = await this.campaignsRepository.findOne({ where: { id } });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return campaign;
  }

  private toResponse(campaign: Campaign): CampaignResponse {
    return {
      id: campaign.id,
      name: campaign.name,
      category: campaign.category,
      priority: campaign.priority,
      status: campaign.status,
      instructions: campaign.instructions,
      startDate: campaign.startDate.toISOString(),
      endDate: campaign.endDate.toISOString(),
      budgetMinor: campaign.budgetMinor,
      rewardPerPostMinor: campaign.rewardPerPostMinor,
      currency: campaign.currency,
      maximumWorkers: campaign.maximumWorkers,
      maximumPostsPerWorker: campaign.maximumPostsPerWorker,
      dailyPostingLimit: campaign.dailyPostingLimit,
      workersJoined: campaign.workersJoined,
      createdAt: campaign.createdAt.toISOString(),
    };
  }
}

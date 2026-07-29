import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission } from '../submissions/submission.entity';
import { Campaign } from '../campaigns/campaign.entity';
import { FacebookGroup } from '../groups/facebook-group.entity';
import { User } from '../users/user.entity';
import { AdminOverviewStatsResponse, AnalyticsOverviewResponse, CategoryPerformanceResponse } from './analytics.response';
import { CampaignStatus, GroupStatus, SubmissionStatus, UserRole } from '../common/enums';

interface CategoryRow {
  category: string;
  total: string;
  approved: string;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Submission) private readonly submissionsRepository: Repository<Submission>,
    @InjectRepository(Campaign) private readonly campaignsRepository: Repository<Campaign>,
    @InjectRepository(FacebookGroup) private readonly groupsRepository: Repository<FacebookGroup>,
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
  ) {}

  async getOverview(): Promise<AnalyticsOverviewResponse> {
    const categoryPerformance = await this.getCategoryPerformance();
    const totalSubmissions = categoryPerformance.reduce((sum, row) => sum + row.submissions, 0);
    const approvedGroups = await this.groupsRepository.count({ where: { status: GroupStatus.APPROVED } });
    const topCategory = [...categoryPerformance].sort((a, b) => b.submissions - a.submissions)[0];

    return {
      cards: [
        {
          key: 'performance',
          title: 'Performance overview',
          description: 'Submissions, approval rate and reward spend trends',
          value: `${totalSubmissions} submissions`,
          trend: 'Live data',
        },
        {
          key: 'quality',
          title: 'Worker quality scores',
          description: 'Distribution of worker trust and accuracy scores',
          value: 'Not yet tracked',
          trend: 'Coming soon',
        },
        {
          key: 'coverage',
          title: 'Coverage & heatmaps',
          description: 'Unique group coverage and posting concentration',
          value: `${approvedGroups} unique groups`,
          trend: `${approvedGroups} approved`,
        },
        {
          key: 'planner',
          title: 'AI campaign planner',
          description: 'Recommended budget and group allocation',
          value: 'Not yet available',
          trend: 'Coming soon',
        },
        {
          key: 'risk',
          title: 'Fraud risk',
          description: 'Duplicate content, bot patterns and rapid submission flags',
          value: 'Not yet available',
          trend: 'Coming soon',
        },
        {
          key: 'category',
          title: 'Category performance',
          description: 'Approval rate and volume by campaign category',
          value: `${categoryPerformance.length} categories tracked`,
          trend: topCategory ? `${topCategory.category} leading` : 'No data yet',
        },
      ],
      categoryPerformance,
    };
  }

  async getAdminOverview(): Promise<AdminOverviewStatsResponse> {
    const [totalWorkers, runningCampaigns, pendingReviews, uniqueGroups] = await Promise.all([
      this.usersRepository.count({ where: { role: UserRole.WORKER } }),
      this.campaignsRepository.count({ where: { status: CampaignStatus.ACTIVE } }),
      this.submissionsRepository
        .createQueryBuilder('submission')
        .where('submission.status IN (:...statuses)', {
          statuses: [SubmissionStatus.PENDING, SubmissionStatus.MANUAL_REVIEW],
        })
        .getCount(),
      this.groupsRepository.count({ where: { status: GroupStatus.APPROVED } }),
    ]);

    return { totalWorkers, runningCampaigns, pendingReviews, uniqueGroups };
  }

  private async getCategoryPerformance(): Promise<CategoryPerformanceResponse[]> {
    const rows = await this.submissionsRepository
      .createQueryBuilder('submission')
      .innerJoin('submission.campaign', 'campaign')
      .select('campaign.category', 'category')
      .addSelect('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN submission.status = :approved THEN 1 ELSE 0 END)', 'approved')
      .setParameter('approved', SubmissionStatus.APPROVED)
      .groupBy('campaign.category')
      .getRawMany<CategoryRow>();

    return rows.map((row) => {
      const total = Number(row.total);
      const approved = Number(row.approved);
      return {
        category: row.category,
        submissions: total,
        approvalRate: total > 0 ? Number((approved / total).toFixed(2)) : 0,
      };
    });
  }
}

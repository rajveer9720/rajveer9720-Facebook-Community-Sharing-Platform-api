import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Achievement } from './achievement.entity';
import { Submission } from '../submissions/submission.entity';
import { AchievementResponse, LeaderboardEntryResponse } from './leaderboard.response';
import { SubmissionStatus } from '../common/enums';

interface LeaderboardRow {
  workerId: number;
  workerName: string;
  approvedPosts: string;
  earningsMinor: string;
}

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(Achievement) private readonly achievementsRepository: Repository<Achievement>,
    @InjectRepository(Submission) private readonly submissionsRepository: Repository<Submission>,
  ) {}

  async getLeaderboard(currentUserId?: number): Promise<LeaderboardEntryResponse[]> {
    const rows = await this.submissionsRepository
      .createQueryBuilder('submission')
      .innerJoin('submission.worker', 'worker')
      .select('submission.workerId', 'workerId')
      .addSelect("CONCAT(worker.firstName, ' ', worker.lastName)", 'workerName')
      .addSelect('COUNT(*)', 'approvedPosts')
      .addSelect('SUM(submission.rewardMinor)', 'earningsMinor')
      .where('submission.status = :status', { status: SubmissionStatus.APPROVED })
      .groupBy('submission.workerId')
      .addGroupBy('worker.firstName')
      .addGroupBy('worker.lastName')
      .orderBy('earningsMinor', 'DESC')
      .getRawMany<LeaderboardRow>();

    return rows.map((row, index) => ({
      rank: index + 1,
      workerId: Number(row.workerId),
      workerName: row.workerName,
      approvedPosts: Number(row.approvedPosts),
      earningsMinor: Number(row.earningsMinor),
      isCurrentWorker: Number(row.workerId) === currentUserId,
    }));
  }

  async getAchievements(currentUserId?: number): Promise<AchievementResponse[]> {
    const catalog = await this.achievementsRepository.find({ order: { sortOrder: 'ASC' } });

    let approvedReviewDates: Date[] = [];
    if (currentUserId) {
      const approved = await this.submissionsRepository.find({
        where: { workerId: currentUserId, status: SubmissionStatus.APPROVED },
        order: { reviewedAt: 'ASC' },
      });
      approvedReviewDates = approved.map((s) => s.reviewedAt).filter((d): d is Date => d !== null);
    }

    return catalog.map((achievement) => {
      const unlockedAt =
        approvedReviewDates.length >= achievement.thresholdApprovedPosts
          ? approvedReviewDates[achievement.thresholdApprovedPosts - 1]
          : null;
      return {
        id: Number(achievement.id),
        title: achievement.title,
        description: achievement.description,
        unlockedAt: unlockedAt ? unlockedAt.toISOString() : null,
      };
    });
  }
}

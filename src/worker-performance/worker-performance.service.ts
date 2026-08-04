import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Worker } from '../workers/worker.entity';
import { Submission } from '../submissions/submission.entity';
import { SubmissionStatus } from '../common/enums';
import { WorkerPerformance } from './worker-performance.entity';
import { WorkerPerformanceResponse } from '../interfaces/worker-performance.interface';

@Injectable()
export class WorkerPerformanceService {
  constructor(
    @InjectRepository(WorkerPerformance)
    private readonly performanceRepository: Repository<WorkerPerformance>,
    @InjectRepository(Submission)
    private readonly submissionsRepository: Repository<Submission>,
    @InjectRepository(Worker)
    private readonly workersRepository: Repository<Worker>,
  ) {}

  async getForWorker(workerId: number): Promise<WorkerPerformanceResponse> {
    let performance = await this.performanceRepository.findOne({ where: { workerId } });
    if (!performance) {
      performance = await this.recomputeForWorker(workerId);
    }
    const worker = await this.workersRepository.findOne({ where: { id: workerId } });
    return this.toResponse(performance, worker ?? undefined);
  }

  async listWorkersPerformance(limit = 100): Promise<WorkerPerformanceResponse[]> {
    const workers = await this.workersRepository.find({ take: limit });
    const workerIds = workers.map((worker) => worker.id);
    if (workerIds.length === 0) {
      return [];
    }

    const workersById = new Map(workers.map((worker) => [worker.id, worker]));
    const performances = await this.performanceRepository.find({ where: { workerId: In(workerIds) } });
    const byWorkerId = new Map(performances.map((entry) => [entry.workerId, entry]));

    const results: WorkerPerformanceResponse[] = [];
    for (const workerId of workerIds) {
      const performance = byWorkerId.get(workerId) ?? (await this.recomputeForWorker(workerId));
      results.push(this.toResponse(performance, workersById.get(workerId)));
    }

    return results.sort((a, b) => b.trustScore - a.trustScore);
  }

  async recomputeForWorker(workerId: number): Promise<WorkerPerformance> {
    const submissions = await this.submissionsRepository.find({ where: { workerId } });
    const totalSubmissions = submissions.length;
    const approvedCount = submissions.filter((submission) => submission.status === SubmissionStatus.APPROVED).length;
    const rejectedCount = submissions.filter((submission) => submission.status === SubmissionStatus.REJECTED).length;
    const pendingCount = submissions.filter(
      (submission) => submission.status === SubmissionStatus.PENDING || submission.status === SubmissionStatus.MANUAL_REVIEW,
    ).length;

    const duplicateCount = submissions.filter((submission) => submission.duplicateProofDetected || submission.duplicateUrlDetected).length;
    const completionDurations = submissions
      .filter((submission) => submission.reviewedAt)
      .map((submission) => Math.max(0, submission.reviewedAt!.getTime() - submission.submittedAt.getTime()));

    const activeDays = new Set(submissions.map((submission) => submission.submittedAt.toISOString().slice(0, 10))).size;

    const approvalRate = totalSubmissions > 0 ? Number((approvedCount / totalSubmissions).toFixed(4)) : 0;
    const rejectionRate = totalSubmissions > 0 ? Number((rejectedCount / totalSubmissions).toFixed(4)) : 0;
    const duplicateRate = totalSubmissions > 0 ? Number((duplicateCount / totalSubmissions).toFixed(4)) : 0;
    const averageCompletionMinutes =
      completionDurations.length > 0
        ? Number((completionDurations.reduce((sum, duration) => sum + duration, 0) / completionDurations.length / 60000).toFixed(2))
        : 0;

    const avgFraudRisk =
      totalSubmissions > 0
        ? Number((submissions.reduce((sum, submission) => sum + submission.fraudRiskScore, 0) / totalSubmissions).toFixed(2))
        : 0;

    const qualityScore = Math.max(0, Math.min(100, Math.round(approvalRate * 100 - duplicateRate * 20 - rejectionRate * 10)));
    const trustScore = Math.max(0, Math.min(100, Math.round(qualityScore - avgFraudRisk * 0.5 + Math.min(10, activeDays / 3))));

    const isFlagged = avgFraudRisk >= 70 || duplicateRate >= 0.5;
    const flaggedReason = isFlagged
      ? avgFraudRisk >= 70
        ? 'High fraud risk average'
        : 'High duplicate submission rate'
      : null;

    let tier = 'STANDARD';
    if (isFlagged) {
      tier = 'WATCHLIST';
    } else if (trustScore >= 85 && approvalRate >= 0.9) {
      tier = 'ELITE';
    } else if (trustScore >= 70 && approvalRate >= 0.75) {
      tier = 'PREMIUM';
    }

    let performance = await this.performanceRepository.findOne({ where: { workerId } });
    if (!performance) {
      performance = this.performanceRepository.create({
        workerId,
      });
    }

    performance.totalSubmissions = totalSubmissions;
    performance.approvedCount = approvedCount;
    performance.rejectedCount = rejectedCount;
    performance.pendingCount = pendingCount;
    performance.approvalRate = approvalRate;
    performance.rejectionRate = rejectionRate;
    performance.duplicateRate = duplicateRate;
    performance.averageCompletionMinutes = averageCompletionMinutes;
    performance.qualityScore = qualityScore;
    performance.trustScore = trustScore;
    performance.fraudRiskScore = avgFraudRisk;
    performance.isFlagged = isFlagged;
    performance.flaggedReason = flaggedReason;
    performance.tier = tier;
    performance.activeDays = activeDays;
    performance.lastRecomputedAt = new Date();

    return this.performanceRepository.save(performance);
  }

  async applyFraudSignal(workerId: number, riskScore: number, reason: string): Promise<WorkerPerformance> {
    let performance = await this.performanceRepository.findOne({ where: { workerId } });
    if (!performance) {
      performance = await this.recomputeForWorker(workerId);
    }

    performance.fraudRiskScore = Number(((performance.fraudRiskScore * 0.7 + riskScore * 0.3)).toFixed(2));
    if (riskScore >= 80 || performance.fraudRiskScore >= 75) {
      performance.isFlagged = true;
      performance.flaggedReason = reason;
      performance.tier = 'WATCHLIST';
    }

    performance.lastRecomputedAt = new Date();
    return this.performanceRepository.save(performance);
  }

  async requireNotFlagged(workerId: number): Promise<void> {
    const performance = await this.performanceRepository.findOne({ where: { workerId } });
    if (!performance) {
      return;
    }

    if (performance.isFlagged) {
      throw new NotFoundException('Worker is temporarily restricted due to fraud risk');
    }
  }

  private toResponse(performance: WorkerPerformance, worker?: Worker): WorkerPerformanceResponse {
    return {
      workerId: performance.workerId,
      workerName: worker ? `${worker.firstName} ${worker.lastName}` : '',
      email: worker?.email ?? '',
      totalSubmissions: performance.totalSubmissions,
      approvedCount: performance.approvedCount,
      rejectedCount: performance.rejectedCount,
      pendingCount: performance.pendingCount,
      approvalRate: performance.approvalRate,
      rejectionRate: performance.rejectionRate,
      duplicateRate: performance.duplicateRate,
      averageCompletionMinutes: performance.averageCompletionMinutes,
      qualityScore: performance.qualityScore,
      trustScore: performance.trustScore,
      fraudRiskScore: performance.fraudRiskScore,
      isFlagged: performance.isFlagged,
      flaggedReason: performance.flaggedReason,
      tier: performance.tier,
      activeDays: performance.activeDays,
      lastRecomputedAt: performance.lastRecomputedAt ? performance.lastRecomputedAt.toISOString() : null,
    };
  }
}
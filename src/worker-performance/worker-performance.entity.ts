import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('worker_performance')
export class WorkerPerformance {
  @PrimaryColumn()
  workerId: number;

  @Column({ default: 0 })
  totalSubmissions: number;

  @Column({ default: 0 })
  approvedCount: number;

  @Column({ default: 0 })
  rejectedCount: number;

  @Column({ default: 0 })
  pendingCount: number;

  @Column({ default: 0 })
  approvalRate: number;

  @Column({ default: 0 })
  rejectionRate: number;

  @Column({ default: 0 })
  duplicateRate: number;

  @Column({ default: 0 })
  averageCompletionMinutes: number;

  @Column({ default: 0 })
  qualityScore: number;

  @Column({ default: 0 })
  trustScore: number;

  @Column({ default: 0 })
  fraudRiskScore: number;

  @Column({ default: false })
  isFlagged: boolean;

  @Column({ type: 'text', nullable: true })
  flaggedReason: string | null;

  @Column({ default: 'STANDARD' })
  tier: string;

  @Column({ default: 0 })
  activeDays: number;

  @Column({ type: 'datetime', nullable: true })
  lastRecomputedAt: Date | null;
}
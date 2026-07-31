export interface WorkerPerformanceResponse {
  workerId: number;
  totalSubmissions: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  approvalRate: number;
  rejectionRate: number;
  duplicateRate: number;
  averageCompletionMinutes: number;
  qualityScore: number;
  trustScore: number;
  fraudRiskScore: number;
  isFlagged: boolean;
  flaggedReason: string | null;
  tier: string;
  activeDays: number;
  lastRecomputedAt: string | null;
}
export interface AnalyticsCardResponse {
  key: string;
  title: string;
  description: string;
  value: string;
  trend: string;
}

export interface CategoryPerformanceResponse {
  category: string;
  submissions: number;
  approvalRate: number;
}

export interface AnalyticsOverviewResponse {
  cards: AnalyticsCardResponse[];
  categoryPerformance: CategoryPerformanceResponse[];
}

export interface AdminOverviewStatsResponse {
  totalWorkers: number;
  runningCampaigns: number;
  pendingReviews: number;
  uniqueGroups: number;
}

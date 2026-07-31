import { CampaignCategory, CampaignPriority, CampaignStatus } from '../common/enums';

export interface CampaignResponse {
  id: number;
  name: string;
  category: CampaignCategory;
  priority: CampaignPriority;
  status: CampaignStatus;
  instructions: string;
  startDate: string;
  endDate: string;
  budgetMinor: number;
  spentMinor: number;
  remainingBudgetMinor: number;
  rewardPerPostMinor: number;
  currency: string;
  maximumWorkers: number;
  maximumPostsPerWorker: number;
  dailyPostingLimit: number;
  workersJoined: number;
  archivedAt: string | null;
  endingSoonNotifiedAt: string | null;
  createdAt: string;
}

import { CampaignCategory, CampaignPriority, CampaignStatus } from '../common/enums';

export interface CampaignResponse {
  id: string;
  name: string;
  category: CampaignCategory;
  priority: CampaignPriority;
  status: CampaignStatus;
  instructions: string;
  startDate: string;
  endDate: string;
  budgetMinor: number;
  rewardPerPostMinor: number;
  currency: string;
  maximumWorkers: number;
  maximumPostsPerWorker: number;
  dailyPostingLimit: number;
  workersJoined: number;
  createdAt: string;
}

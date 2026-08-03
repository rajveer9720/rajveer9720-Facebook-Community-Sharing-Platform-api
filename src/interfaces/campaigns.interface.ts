import { CampaignCategory, CampaignPriority, CampaignStatus } from '../common/enums';

export interface CampaignMediaVariant {
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
  caption: string;
}

export interface CampaignResponse {
  id: number;
  name: string;
  category: CampaignCategory;
  priority: CampaignPriority;
  status: CampaignStatus;
  instructions: string;
  mediaVariants: CampaignMediaVariant[];
  verificationSettings: {
    screenshotRequired: boolean;
    facebookPostUrlRequired: boolean;
    groupNameRequired: boolean;
    manualReviewRequired: boolean;
    aiVerificationEnabled: boolean;
    autoApprovalEnabled: boolean;
  };
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

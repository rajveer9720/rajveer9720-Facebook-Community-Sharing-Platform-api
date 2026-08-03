import { GroupStatus } from '../common/enums';

export interface GroupResponse {
  id: number;
  name: string;
  category: string;
  country: string;
  url: string | null;
  language: string | null;
  privacyType: string | null;
  qualityScore: number;
  engagementScore: number;
  spamScore: number;
  blacklisted: boolean;
  cooldownHours: number;
  lastWorkerId: number | null;
  lastCampaignId: number | null;
  status: GroupStatus;
  memberCount: number;
}

export interface WorkerGroupLibraryEntryResponse {
  id: number;
  groupId: number;
  group: GroupResponse;
  timesUsed: number;
  lastPostedAt: string | null;
  availableAt: string | null;
}

export interface GroupRecommendationResponse {
  assignmentId: number;
  campaignId: number;
  cooldownUntil: string;
  group: GroupResponse;
}

export interface GroupCoverageStatsResponse {
  approvedGroups: number;
  pendingDiscoveries: number;
  uniqueGroupsCovered: number;
  duplicateGroupRate: number;
}

import { GroupStatus } from '../common/enums';

export interface GroupResponse {
  id: string;
  name: string;
  category: string;
  country: string;
  qualityScore: number;
  cooldownHours: number;
  status: GroupStatus;
  memberCount: number;
}

export interface WorkerGroupLibraryEntryResponse {
  id: string;
  groupId: string;
  group: GroupResponse;
  timesUsed: number;
  lastPostedAt: string | null;
  availableAt: string | null;
}

export interface GroupCoverageStatsResponse {
  approvedGroups: number;
  pendingDiscoveries: number;
  uniqueGroupsCovered: number;
  duplicateGroupRate: number;
}

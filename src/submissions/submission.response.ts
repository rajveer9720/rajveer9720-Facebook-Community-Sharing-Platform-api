import { SubmissionStatus } from '../common/enums';

export interface SubmissionResponse {
  id: string;
  campaignId: string;
  campaignName: string;
  workerId: string;
  workerName: string;
  groupId: string;
  groupName: string;
  status: SubmissionStatus;
  proofUrl: string;
  caption: string;
  rewardMinor: number;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}

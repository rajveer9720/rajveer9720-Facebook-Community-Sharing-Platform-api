import { SubmissionStatus } from '../common/enums';

export interface SubmissionMediaVariantResponse {
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO';
  caption: string;
}

export interface SubmissionResponse {
  id: number;
  campaignId: number;
  campaignName: string;
  workerId: number;
  workerName: string;
  groupId: number;
  groupName: string;
  status: SubmissionStatus;
  proofUrl: string | null;
  facebookPostUrl: string | null;
  submittedGroupName: string | null;
  assignedMediaVariant: SubmissionMediaVariantResponse | null;
  caption: string;
  rewardMinor: number;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string;
  verificationConfidence: number;
  verificationExplanation: string;
  duplicateProofDetected: boolean;
  duplicateUrlDetected: boolean;
  fraudRiskScore: number;
  flaggedForFraud: boolean;
  fraudSignals: Record<string, unknown>;
}

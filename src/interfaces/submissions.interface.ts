import { SubmissionStatus } from '../common/enums';

export interface SubmissionVerificationSettings {
  screenshotRequired: boolean;
  facebookPostUrlRequired: boolean;
  groupNameRequired: boolean;
  manualReviewRequired: boolean;
  aiVerificationEnabled: boolean;
  autoApprovalEnabled: boolean;
}

export interface PreReviewCheckResult {
  duplicateProofDetected: boolean;
  duplicateUrlDetected: boolean;
  screenshotVisible: boolean;
  ocrText: string;
  captionMatch: boolean;
  imageMatch: boolean;
  groupNameMatch: boolean;
  dateVisible: boolean;
  timeVisible: boolean;
  aiVerificationAvailable: boolean;
  aiAutoApproveRecommended: boolean;
  confidence: number;
  explanation: string;
}

export interface FraudRiskAssessment {
  fraudRiskScore: number;
  flaggedForFraud: boolean;
  signals: Record<string, unknown>;
}

export interface SubmissionStatusDecision {
  status: SubmissionStatus;
  reviewNote: string | null;
}

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

export interface AiVerificationResult {
  available: boolean;
  screenshotVisible: boolean;
  ocrText: string;
  captionMatch: boolean;
  imageMatch: boolean;
  groupNameMatch: boolean;
  dateVisible: boolean;
  timeVisible: boolean;
  confidence: number;
  notes: string;
}

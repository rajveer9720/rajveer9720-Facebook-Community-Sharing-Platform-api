export enum UserRole {
  ADMIN = 'ADMIN',
  WORKER = 'WORKER',
}

export enum CampaignCategory {
  CRYPTO = 'Crypto',
  BUSINESS = 'Business',
  INVESTMENT = 'Investment',
  TRADING = 'Trading',
  FINANCE = 'Finance',
  TECHNOLOGY = 'Technology',
  JOBS = 'Jobs',
  MLM = 'MLM',
}

export enum CampaignPriority {
  NORMAL = 'Normal',
  HIGH = 'High',
  URGENT = 'Urgent',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum GroupStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum SubmissionStatus {
  PENDING = 'PENDING',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ReviewDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
  REQUEST_RESUBMISSION = 'REQUEST_RESUBMISSION',
}

export enum WithdrawalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
}

export enum PaymentMethod {
  BANK_TRANSFER = 'Bank transfer',
  PAYPAL = 'PayPal',
  OTHER = 'Other',
}

export enum WithdrawalReviewAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export interface PermissionPair {
  action: string;
  subject: string;
}

export const PERMISSIONS = {
  READ_CAMPAIGN: { action: 'read', subject: 'Campaign' },
  MANAGE_CAMPAIGN: { action: 'manage', subject: 'Campaign' },
  READ_GROUP: { action: 'read', subject: 'Group' },
  MODERATE_GROUP: { action: 'moderate', subject: 'Group' },
  READ_SUBMISSION: { action: 'read', subject: 'Submission' },
  REVIEW_SUBMISSION: { action: 'review', subject: 'Submission' },
  READ_FRAUD_SIGNAL: { action: 'read', subject: 'FraudSignal' },
  REVIEW_WITHDRAWAL: { action: 'review', subject: 'Withdrawal' },
  COMPLETE_WITHDRAWAL: { action: 'complete', subject: 'Withdrawal' },
  READ_FINANCE_ANALYTICS: { action: 'read', subject: 'FinanceAnalytics' },
  READ_WORKER_DIRECTORY: { action: 'read', subject: 'WorkerDirectory' },
  RESTRICT_WORKER: { action: 'restrict', subject: 'Worker' },
  MANAGE_STAFF: { action: 'manage', subject: 'Staff' },
  READ_AUDIT_LOG: { action: 'read', subject: 'AuditLog' },
  MANAGE_SYSTEM_CONFIG: { action: 'manage', subject: 'SystemConfig' },
} as const satisfies Record<string, PermissionPair>;

export const ALL_PERMISSIONS: PermissionPair[] = Object.values(PERMISSIONS);

export interface DefaultRoleSeed {
  name: string;
  slug: string;
  permissions: PermissionPair[];
}

export const DEFAULT_ROLES: DefaultRoleSeed[] = [
  {
    name: 'Moderator',
    slug: 'moderator',
    permissions: [
      PERMISSIONS.READ_CAMPAIGN,
      PERMISSIONS.READ_GROUP,
      PERMISSIONS.MODERATE_GROUP,
      PERMISSIONS.READ_SUBMISSION,
      PERMISSIONS.READ_FRAUD_SIGNAL,
      PERMISSIONS.READ_WORKER_DIRECTORY,
    ],
  },
  {
    name: 'Reviewer',
    slug: 'reviewer',
    permissions: [
      PERMISSIONS.READ_CAMPAIGN,
      PERMISSIONS.READ_SUBMISSION,
      PERMISSIONS.REVIEW_SUBMISSION,
      PERMISSIONS.READ_FRAUD_SIGNAL,
      PERMISSIONS.READ_WORKER_DIRECTORY,
    ],
  },
  {
    name: 'Finance Manager',
    slug: 'finance-manager',
    permissions: [PERMISSIONS.REVIEW_WITHDRAWAL, PERMISSIONS.COMPLETE_WITHDRAWAL, PERMISSIONS.READ_FINANCE_ANALYTICS],
  },
  {
    name: 'Admin',
    slug: 'admin',
    permissions: [
      PERMISSIONS.READ_CAMPAIGN,
      PERMISSIONS.MANAGE_CAMPAIGN,
      PERMISSIONS.READ_GROUP,
      PERMISSIONS.MODERATE_GROUP,
      PERMISSIONS.READ_SUBMISSION,
      PERMISSIONS.REVIEW_SUBMISSION,
      PERMISSIONS.READ_FRAUD_SIGNAL,
      PERMISSIONS.REVIEW_WITHDRAWAL,
      PERMISSIONS.READ_FINANCE_ANALYTICS,
      PERMISSIONS.READ_WORKER_DIRECTORY,
      PERMISSIONS.RESTRICT_WORKER,
      PERMISSIONS.READ_AUDIT_LOG,
    ],
  },
  {
    name: 'Super Admin',
    slug: 'super-admin',
    permissions: ALL_PERMISSIONS,
  },
];

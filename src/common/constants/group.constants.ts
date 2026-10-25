export const GROUP_PRIVACY_TYPES = ['PUBLIC', 'PRIVATE', 'MIXED'] as const;

export const GROUP_MODERATION_ACTIONS = [
  'approve',
  'reject',
  'blacklist',
  'unblacklist',
  'APPROVE',
  'REJECT',
  'BLACKLIST',
  'UNBLACKLIST',
] as const;

export const DEFAULT_GROUP_COOLDOWN_HOURS = 48;
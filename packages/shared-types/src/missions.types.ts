/** Mission type taxonomy used by manager routing and workers. */
export const MissionType = {
  OPERATOR_QUERY: 'operator_query',
  ALERT_INVESTIGATION: 'alert_investigation',
  COMPARISON: 'comparison',
  DEVIL_ADVOCATE: 'devil_advocate',
  PATTERN_REQUEST: 'pattern_request',
  EARNINGS_PREBRIEF: 'earnings_prebrief',
  TRADE_REQUEST: 'trade_request',
  DAILY_BRIEF: 'daily_brief'
} as const;

export type MissionType = (typeof MissionType)[keyof typeof MissionType];

/** Lifecycle states for a mission. */
export const MissionStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETE: 'complete',
  FAILED: 'failed'
} as const;

export type MissionStatus = (typeof MissionStatus)[keyof typeof MissionStatus];

/** Event sources that can trigger a mission. */
export const MissionTrigger = {
  TELEGRAM: 'telegram',
  WATCHDOG: 'watchdog',
  SCHEDULED: 'scheduled',
  KB_FAST_PATH: 'kb_fast_path',
  MANUAL: 'manual'
} as const;

export type MissionTrigger = (typeof MissionTrigger)[keyof typeof MissionTrigger];

/** Alert categories produced by watchdog and bookkeeping logic. */
export const AlertType = {
  PRICE_SPIKE: 'price_spike',
  VOLUME_SPIKE: 'volume_spike',
  NEWS_EVENT: 'news_event',
  MACRO_RISK: 'macro_risk',
  THESIS_CONTRADICTION: 'thesis_contradiction',
  EARNINGS_APPROACHING: 'earnings_approaching',
  PATTERN_SIGNAL: 'pattern_signal'
} as const;

export type AlertType = (typeof AlertType)[keyof typeof AlertType];

/** Alert severity levels for operator prioritization. */
export const AlertSeverity = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
} as const;

export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];

/** KB thesis change category. */
export const ChangeType = {
  INITIAL: 'initial',
  UPDATE: 'update',
  CONTRADICTION: 'contradiction',
  DEVIL_ADVOCATE: 'devil_advocate'
} as const;

export type ChangeType = (typeof ChangeType)[keyof typeof ChangeType];

/** Trade ticket states from creation to closure. */
export const TicketStatus = {
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled'
} as const;

export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

/** Role matrix for API and Telegram authorization. */
export const UserRole = {
  ADMIN: 'admin',
  ANALYST: 'analyst',
  VIEWER: 'viewer'
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

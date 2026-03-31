import { z } from 'zod';

export const collectorAgentNameSchema = z.enum(['watchdog', 'screener', 'researcher', 'technician']);
export type CollectorAgentName = z.infer<typeof collectorAgentNameSchema>;

export const collectorStateSchema = z.enum(['active', 'idle', 'error']);
export type CollectorState = z.infer<typeof collectorStateSchema>;

export const watchdogAlertTypeSchema = z.enum([
  'price_spike',
  'volume_spike',
  'news_event',
  'earnings_approaching',
  'pattern_signal'
]);
export type WatchdogAlertType = z.infer<typeof watchdogAlertTypeSchema>;

export const screenerTriggerSchema = z.enum(['scheduled', 'manual']);
export type ScreenerTrigger = z.infer<typeof screenerTriggerSchema>;

export const llmUsageSchema = z.object({
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative()
}).strict();
export type LlmUsage = z.infer<typeof llmUsageSchema>;

export interface CollectorStatePayload {
  state: CollectorState;
  currentTask?: string;
  currentMissionId?: string;
  startedAt?: string;
  lastActiveAt?: string;
  lastActivitySummary?: string;
  errorMessage?: string;
}

export interface MonitoringSnapshotInput {
  watchlistItemId: string;
  ticker: string;
  price: number;
  changePct: number;
  volume: bigint;
}

export interface WatchdogAlertInput {
  userId: string;
  ticker: string;
  alertType: WatchdogAlertType;
  severity: 'low' | 'medium' | 'high';
  message: string;
  context: Record<string, unknown>;
}

export interface DiscoveryFinding {
  ticker: string;
  sector: string;
  reason: string;
  signalScore: number;
  supportingHeadline?: string;
}

export interface DiscoveryRunPersisted {
  runId: string;
  triggeredBy: ScreenerTrigger;
  results: DiscoveryFinding[];
  metadata: {
    noCandidates: boolean;
  };
}

export interface ResearchCollectionOutput {
  ticker: string;
  focusQuestions: string[];
  missionType: string;
  collectedFacts: Array<Record<string, unknown>>;
  newsSummary: Record<string, unknown>;
  fundamentalsSummary: Record<string, unknown>;
  kbContext: Array<Record<string, unknown>>;
  confidence: 'low' | 'medium' | 'high';
  gaps: string[];
  _usage?: LlmUsage | undefined;
}

export interface TechnicalCollectionOutput {
  ticker: string;
  periodWeeks: number;
  trend: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  levels: {
    support: number;
    resistance: number;
  };
  patterns: string[];
  indicators: {
    rsi: number | undefined;
    stochastic: number | undefined;
    macdHistogram: number | undefined;
    volatility: number | undefined;
    averageVolume: number | undefined;
  };
  confidence: number;
  limitations: string[];
  summary: string;
  _usage?: LlmUsage | undefined;
}

export const researchCollectionOutputSchema = z.object({
  ticker: z.string().min(1),
  focusQuestions: z.array(z.string().min(1)),
  missionType: z.string().min(1),
  collectedFacts: z.array(z.record(z.string(), z.unknown())),
  newsSummary: z.record(z.string(), z.unknown()),
  fundamentalsSummary: z.record(z.string(), z.unknown()),
  kbContext: z.array(z.record(z.string(), z.unknown())),
  confidence: z.enum(['low', 'medium', 'high']),
  gaps: z.array(z.string()),
  _usage: llmUsageSchema.optional()
}).strict();

export const technicalCollectionOutputSchema = z.object({
  ticker: z.string().min(1),
  periodWeeks: z.number().int().positive(),
  trend: z.enum(['bullish', 'bearish', 'neutral', 'mixed']),
  levels: z.object({
    support: z.number(),
    resistance: z.number()
  }).strict(),
  patterns: z.array(z.string()),
  indicators: z.object({
    rsi: z.number().min(0).max(100).optional(),
    stochastic: z.number().min(0).max(100).optional(),
    macdHistogram: z.number().optional(),
    volatility: z.number().min(0).optional(),
    averageVolume: z.number().min(0).optional()
  }).strict(),
  confidence: z.number().min(0).max(1),
  limitations: z.array(z.string()),
  summary: z.string().min(1),
  _usage: llmUsageSchema.optional()
}).strict();

export type ResearchCollectionOutputValidated = z.infer<typeof researchCollectionOutputSchema>;
export type TechnicalCollectionOutputValidated = z.infer<typeof technicalCollectionOutputSchema>;

export interface WatchdogRunResult {
  snapshotsWritten: number;
  alertsCreated: number;
  alerts: Array<{ ticker: string; alertType: WatchdogAlertType }>;
  warnings: string[];
}

import { z } from 'zod';

import { llmUsageSchema, researchCollectionOutputSchema, technicalCollectionOutputSchema } from './collectors.js';

export const analystModeSchema = z.enum(['standard', 'devil_advocate', 'comparison']);
export type AnalystMode = z.infer<typeof analystModeSchema>;

export const reasoningConfidenceSchema = z.enum(['low', 'medium', 'high']);
export type ReasoningConfidence = z.infer<typeof reasoningConfidenceSchema>;

export const contradictionSeveritySchema = z.enum(['none', 'low', 'high']);
export type ContradictionSeverity = z.infer<typeof contradictionSeveritySchema>;

export const kbChangeTypeSchema = z.enum(['initial', 'update', 'contradiction', 'devil_advocate']);
export type KbChangeType = z.infer<typeof kbChangeTypeSchema>;

export const traderActionSchema = z.enum(['buy', 'sell']);
export type TraderAction = z.infer<typeof traderActionSchema>;

export const tradeTicketStatusSchema = z.enum(['pending_approval']);
export type TradeTicketStatus = z.infer<typeof tradeTicketStatusSchema>;

export const TELEGRAM_MESSAGE_MAX_LENGTH = 4096;
export const COMPARISON_MODE_REQUIRED_TICKER_COUNT = 2;
export const KB_EMBEDDING_VECTOR_LENGTH = 1536;

export const analystOutputSchema = z
  .object({
    ticker: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
    mode: analystModeSchema,
    thesisUpdate: z.string().min(1),
    supportingEvidence: z.array(z.string().min(1)),
    riskFactors: z.array(z.string().min(1)),
    contradictions: z.array(z.string().min(1)),
    confidence: reasoningConfidenceSchema,
    confidenceReason: z.string().min(1),
    comparisonTable: z.record(z.string(), z.unknown()).optional(),
    _usage: llmUsageSchema.optional()
  })
  .strict();
export type AnalystOutput = z.infer<typeof analystOutputSchema>;

export const bookkeeperOutputSchema = z
  .object({
    kbEntryId: z.string().min(1),
    changeType: kbChangeTypeSchema,
    contradictionSeverity: contradictionSeveritySchema,
    snapshotCreated: z.boolean(),
    _usage: llmUsageSchema.optional()
  })
  .strict();
export type BookkeeperOutput = z.infer<typeof bookkeeperOutputSchema>;

export const reporterOutputSchema = z
  .object({
    delivered: z.boolean(),
    messageCount: z.number().int().nonnegative(),
    label: z.string().min(1),
    persistedDailyBriefId: z.string().min(1).optional(),
    failedChunkCount: z.number().int().nonnegative(),
    _usage: llmUsageSchema.optional()
  })
  .strict();
export type ReporterOutput = z.infer<typeof reporterOutputSchema>;

export const traderOutputSchema = z
  .object({
    ticketId: z.string().min(1),
    status: tradeTicketStatusSchema,
    rationale: z.string().min(1),
    warningText: z.string().min(1),
    _usage: llmUsageSchema.optional()
  })
  .strict();
export type TraderOutput = z.infer<typeof traderOutputSchema>;

export const runAnalystInputSchema = z
  .object({
    userId: z.string().min(1),
    missionId: z.string().min(1),
    mode: analystModeSchema,
    research: z.union([researchCollectionOutputSchema, z.array(researchCollectionOutputSchema).min(1)]),
    portfolioContext: z
      .object({
        ticker: z.string().min(1),
        quantity: z.number(),
        avgCost: z.number().optional()
      })
      .optional(),
    existingThesis: z
      .object({
        content: z.string().min(1),
        updatedAt: z.string().min(1),
        confidence: reasoningConfidenceSchema
      })
      .optional()
  })
  .strict();
export type RunAnalystInput = z.infer<typeof runAnalystInputSchema>;

export const runBookkeeperInputSchema = z
  .object({
    userId: z.string().min(1),
    missionId: z.string().min(1),
    missionType: z.string().min(1),
    analystOutput: analystOutputSchema
  })
  .strict();
export type RunBookkeeperInput = z.infer<typeof runBookkeeperInputSchema>;

export const runReporterInputSchema = z
  .object({
    userId: z.string().min(1),
    missionId: z.string().min(1),
    missionType: z.string().min(1),
    payload: z.record(z.string(), z.unknown())
  })
  .strict();
export type RunReporterInput = z.infer<typeof runReporterInputSchema>;

export const runTraderInputSchema = z
  .object({
    userId: z.string().min(1),
    missionId: z.string().min(1),
    ticker: z.string().min(1),
    action: traderActionSchema,
    quantity: z.number().positive(),
    analystOutput: analystOutputSchema
  })
  .strict();
export type RunTraderInput = z.infer<typeof runTraderInputSchema>;

export const compatibilityEnvelopeSchema = z
  .object({
    technical: technicalCollectionOutputSchema.optional(),
    discoveries: z.array(z.record(z.string(), z.unknown())).optional()
  })
  .strict();
export type CompatibilityEnvelope = z.infer<typeof compatibilityEnvelopeSchema>;

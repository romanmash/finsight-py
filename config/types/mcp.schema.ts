import { z } from 'zod';

const retryPolicySchema = z.object({
  maxAttempts: z.number().int().positive(),
  backoffMs: z.number().int().nonnegative()
}).strict();

const cacheSchema = z.object({
  quoteTtlSec: z.number().int().positive().optional(),
  fundamentalsTtlSec: z.number().int().positive().optional(),
  earningsTtlSec: z.number().int().positive().optional(),
  ratingsTtlSec: z.number().int().positive().optional(),
  gdeltTtlSec: z.number().int().positive().optional(),
  ecoCalendarTtlSec: z.number().int().positive().optional(),
  indicatorTtlSec: z.number().int().positive().optional(),
  latestTtlSec: z.number().int().positive().optional(),
  sentimentTtlSec: z.number().int().positive().optional()
}).strict();

const serverSchema = z.object({
  url: z.string().url(),
  timeoutMs: z.number().int().positive(),
  retry: retryPolicySchema.optional(),
  cache: cacheSchema.optional()
}).strict();

const providerSchema = z.object({
  marketDataBaseUrl: z.string().url(),
  fmpBaseUrl: z.string().url(),
  gdeltBaseUrl: z.string().url(),
  alphaVantageBaseUrl: z.string().url(),
  newsBaseUrl: z.string().url()
}).strict();

export const mcpConfigSchema = z.object({
  invoke: z.object({
    defaultTimeoutMs: z.number().int().positive(),
    defaultRetry: retryPolicySchema
  }).strict().optional(),
  providers: providerSchema,
  retrieval: z.object({
    vectorWeight: z.number().min(0).max(1),
    bm25Weight: z.number().min(0).max(1),
    rrfK: z.number().int().positive()
  }).strict().optional(),
  trader: z.object({
    requireApprovalForNonMock: z.boolean()
  }).strict().optional(),
  servers: z.object({
    marketData: serverSchema,
    macroSignals: serverSchema,
    news: serverSchema,
    ragRetrieval: serverSchema,
    enterpriseConnector: serverSchema,
    traderPlatform: serverSchema
  }).strict()
}).strict();

export type McpConfig = z.infer<typeof mcpConfigSchema>;

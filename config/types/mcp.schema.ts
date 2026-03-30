import { z } from 'zod';

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
  cache: cacheSchema.optional()
}).strict();

export const mcpConfigSchema = z.object({
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

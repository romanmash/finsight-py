import { z } from 'zod';

export const appConfigSchema = z.object({
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']),
  featureFlags: z.object({
    devilsAdvocate: z.boolean(),
    traderAgent: z.boolean(),
    screenerAgent: z.boolean(),
    hotConfigReload: z.boolean()
  }).strict(),
  collector: z.object({
    stateTtlSeconds: z.number().int().positive(),
    researcherMaxToolSteps: z.number().int().positive()
  }).strict(),
  kbFastPathFreshnessHours: z.number().int().positive(),
  patternDefaultPeriodWeeks: z.number().int().positive()
}).strict();

export type AppRuntimeConfig = z.infer<typeof appConfigSchema>;

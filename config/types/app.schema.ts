import { z } from 'zod';

export const appConfigSchema = z.object({
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']),
  featureFlags: z.object({
    devilsAdvocate: z.boolean(),
    traderAgent: z.boolean(),
    screenerAgent: z.boolean(),
    hotConfigReload: z.boolean()
  }).strict()
}).strict();

export type AppRuntimeConfig = z.infer<typeof appConfigSchema>;

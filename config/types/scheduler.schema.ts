import { z } from 'zod';

const jobSchema = z.object({
  cron: z.string().min(1),
  concurrency: z.number().int().positive(),
  retryAttempts: z.number().int().nonnegative(),
  retryBackoffMs: z.number().int().nonnegative()
}).strict();

export const schedulerConfigSchema = z.object({
  watchdogScan: jobSchema,
  screenerScan: jobSchema,
  dailyBrief: jobSchema,
  earningsCheck: jobSchema,
  ticketExpiry: jobSchema
}).strict();

export type SchedulerConfig = z.infer<typeof schedulerConfigSchema>;
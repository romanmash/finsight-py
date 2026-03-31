import { z } from 'zod';

const scheduledJobSchema = z.object({
  cron: z.string().min(1),
  concurrency: z.number().int().positive(),
  retryAttempts: z.number().int().nonnegative(),
  retryBackoffMs: z.number().int().nonnegative()
}).strict();

const processingJobSchema = z.object({
  concurrency: z.number().int().positive(),
  retryAttempts: z.number().int().nonnegative(),
  retryBackoffMs: z.number().int().nonnegative()
}).strict();

export const schedulerConfigSchema = z.object({
  watchdogScan: scheduledJobSchema,
  screenerScan: scheduledJobSchema,
  dailyBrief: scheduledJobSchema,
  earningsCheck: scheduledJobSchema,
  ticketExpiry: scheduledJobSchema,
  alertPipeline: processingJobSchema
}).strict();

export type SchedulerConfig = z.infer<typeof schedulerConfigSchema>;

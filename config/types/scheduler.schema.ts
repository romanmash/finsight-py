import { z } from 'zod';

const jobSchema = z.object({
  cron: z.string().min(1),
  concurrency: z.number().int().positive()
}).strict();

export const schedulerConfigSchema = z.object({
  watchdogScan: jobSchema,
  screenerScan: jobSchema,
  dailyBrief: jobSchema,
  earningsCheck: jobSchema,
  ticketExpiry: jobSchema
}).strict();

export type SchedulerConfig = z.infer<typeof schedulerConfigSchema>;

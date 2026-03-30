import { z } from 'zod';

export const watchdogConfigSchema = z.object({
  priceAlertThresholdPct: z.number().nonnegative(),
  volumeSpikeMultiplier: z.number().nonnegative(),
  earningsPreBriefDaysAhead: z.number().int().nonnegative(),
  newsLookbackMinutes: z.number().int().nonnegative()
}).strict();

export type WatchdogConfig = z.infer<typeof watchdogConfigSchema>;

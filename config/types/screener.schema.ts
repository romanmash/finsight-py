import { z } from 'zod';

export const screenerConfigSchema = z.object({
  sectors: z.array(z.string().min(1)).min(1),
  minimumSignalScore: z.number().min(0).max(1),
  topResultsPerRun: z.number().int().positive()
}).strict();

export type ScreenerConfig = z.infer<typeof screenerConfigSchema>;

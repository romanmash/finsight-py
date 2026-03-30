import { z } from 'zod';

export const ragConfigSchema = z.object({
  embeddingModel: z.string().min(1),
  embeddingDimensions: z.number().int().positive(),
  chunkSize: z.number().int().positive(),
  chunkOverlap: z.number().int().nonnegative(),
  topK: z.number().int().positive(),
  bm25Weight: z.number().min(0).max(1),
  freshnessBoostDays: z.number().int().nonnegative(),
  rrfK: z.number().int().positive(),
  maxThesisAgeHours: z.number().int().positive()
}).strict();

export type RagConfig = z.infer<typeof ragConfigSchema>;

import { z } from 'zod';

export const telegramConfigSchema = z.object({
  rateLimitPerUserPerMinute: z.number().int().positive(),
  commandAliases: z.record(z.string(), z.array(z.string().min(1)).min(1))
}).strict();

export type TelegramConfig = z.infer<typeof telegramConfigSchema>;

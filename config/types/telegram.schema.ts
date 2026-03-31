import { z } from 'zod';

export const telegramConfigSchema = z.object({
  rateLimitPerUserPerMinute: z.number().int().positive(),
  commandBehavior: z.object({
    allowFreeTextOperatorQuery: z.boolean(),
    enabledCommands: z.record(z.string(), z.boolean())
  }).strict(),
  responseMessages: z.object({
    unauthorized: z.string().min(1),
    throttled: z.string().min(1),
    validationError: z.string().min(1),
    temporaryUnavailable: z.string().min(1),
    internalFailure: z.string().min(1)
  }).strict(),
  delivery: z.object({
    messageMaxLength: z.number().int().positive(),
    gracefulShutdownMs: z.number().int().positive()
  }).strict(),
  performance: z.object({
    acknowledgmentP95Ms: z.number().int().positive()
  }).strict()
}).strict();

export type TelegramConfig = z.infer<typeof telegramConfigSchema>;

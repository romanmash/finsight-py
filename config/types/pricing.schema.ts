import { z } from 'zod';

const modelRateSchema = z.object({
  inputPer1kTokens: z.number().nonnegative(),
  outputPer1kTokens: z.number().nonnegative()
}).strict();

const providerRatesSchema = z.record(z.string(), modelRateSchema);

export const pricingConfigSchema = z.object({
  providers: z.object({
    anthropic: providerRatesSchema,
    openai: providerRatesSchema,
    azure: providerRatesSchema,
    lmstudio: providerRatesSchema
  }).strict(),
  dailyBudgetUsd: z.number().nonnegative(),
  alertThresholdPct: z.number().nonnegative().max(100)
}).strict();

export type PricingConfig = z.infer<typeof pricingConfigSchema>;

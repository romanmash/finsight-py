import { z } from 'zod';

const providerSchema = z.enum(['anthropic', 'openai', 'azure', 'lmstudio']);

export const agentModelConfigSchema = z.object({
  provider: providerSchema,
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().positive()
}).strict();

export const agentConfigSchema = z.object({
  primary: agentModelConfigSchema,
  fallback: agentModelConfigSchema.optional(),
  devilAdvocateTemperature: z.number().min(0).max(2).optional()
}).strict();

export const agentsConfigSchema = z.object({
  manager: agentConfigSchema,
  watchdog: agentConfigSchema,
  screener: agentConfigSchema,
  researcher: agentConfigSchema,
  analyst: agentConfigSchema,
  technician: agentConfigSchema,
  bookkeeper: agentConfigSchema,
  reporter: agentConfigSchema,
  trader: agentConfigSchema,
  confidence: z.object({
    reDispatchOnLow: z.boolean()
  }).strict()
}).strict();

export type AgentsConfig = z.infer<typeof agentsConfigSchema>;

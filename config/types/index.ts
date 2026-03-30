import type { z } from 'zod';

import { agentsConfigSchema, type AgentsConfig } from './agents.schema.js';
import { pricingConfigSchema, type PricingConfig } from './pricing.schema.js';
import { mcpConfigSchema, type McpConfig } from './mcp.schema.js';
import { schedulerConfigSchema, type SchedulerConfig } from './scheduler.schema.js';
import { watchdogConfigSchema, type WatchdogConfig } from './watchdog.schema.js';
import { screenerConfigSchema, type ScreenerConfig } from './screener.schema.js';
import { ragConfigSchema, type RagConfig } from './rag.schema.js';
import { traderConfigSchema, type TraderConfig } from './trader.schema.js';
import { authConfigSchema, type AuthConfig } from './auth.schema.js';
import { telegramConfigSchema, type TelegramConfig } from './telegram.schema.js';
import { appConfigSchema, type AppRuntimeConfig } from './app.schema.js';

export {
  agentsConfigSchema,
  pricingConfigSchema,
  mcpConfigSchema,
  schedulerConfigSchema,
  watchdogConfigSchema,
  screenerConfigSchema,
  ragConfigSchema,
  traderConfigSchema,
  authConfigSchema,
  telegramConfigSchema,
  appConfigSchema
};

export type {
  AgentsConfig,
  PricingConfig,
  McpConfig,
  SchedulerConfig,
  WatchdogConfig,
  ScreenerConfig,
  RagConfig,
  TraderConfig,
  AuthConfig,
  TelegramConfig,
  AppRuntimeConfig
};

export interface AppConfig {
  agents: AgentsConfig;
  pricing: PricingConfig;
  mcp: McpConfig;
  scheduler: SchedulerConfig;
  watchdog: WatchdogConfig;
  screener: ScreenerConfig;
  rag: RagConfig;
  trader: TraderConfig;
  auth: AuthConfig;
  telegram: TelegramConfig;
  app: AppRuntimeConfig;
}

export const appConfigSchemas: Record<keyof AppConfig, z.ZodTypeAny> = {
  agents: agentsConfigSchema,
  pricing: pricingConfigSchema,
  mcp: mcpConfigSchema,
  scheduler: schedulerConfigSchema,
  watchdog: watchdogConfigSchema,
  screener: screenerConfigSchema,
  rag: ragConfigSchema,
  trader: traderConfigSchema,
  auth: authConfigSchema,
  telegram: telegramConfigSchema,
  app: appConfigSchema
};

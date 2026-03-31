import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { load as loadYaml } from 'js-yaml';

import { telegramConfigSchema } from '../../../config/types/telegram.schema.js';
import type { TelegramConfigView } from './types.js';

export interface BotEnv {
  telegramBotToken: string;
  internalToken: string;
  apiBaseUrl: string;
  apiAccessToken: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }

  return value.trim();
}

function getConfigDir(): string {
  return process.env.CONFIG_DIR ?? resolve(process.cwd(), 'config/runtime');
}

export async function loadTelegramRuntimeConfig(): Promise<TelegramConfigView> {
  const configPath = resolve(getConfigDir(), 'telegram.yaml');
  const raw = await readFile(configPath, 'utf8');
  const parsed = loadYaml(raw);

  const result = telegramConfigSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join('.') ?? 'root';
    throw new Error(`telegram.${path}: ${first?.message ?? 'invalid config'}`);
  }

  return result.data;
}

export function loadBotEnv(): BotEnv {
  return {
    telegramBotToken: requireEnv('TELEGRAM_BOT_TOKEN'),
    internalToken: requireEnv('TELEGRAM_INTERNAL_TOKEN'),
    apiBaseUrl: process.env.API_BASE_URL?.trim() || 'http://api:3000',
    apiAccessToken: requireEnv('TELEGRAM_API_ACCESS_TOKEN')
  };
}

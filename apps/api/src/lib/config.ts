import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { load as loadYaml } from 'js-yaml';
import { ZodError } from 'zod';

import { appConfigSchemas, type AppConfig } from '../../../../config/types/index.js';

const CONFIG_KEYS = Object.keys(appConfigSchemas) as Array<keyof AppConfig>;

let configCache: AppConfig | null = null;

class ConfigValidationError extends Error {
  readonly fileKey: keyof AppConfig;
  readonly zodError: ZodError;

  constructor(fileKey: keyof AppConfig, zodError: ZodError) {
    super(`Config validation failed in ${fileKey}.yaml`);
    this.fileKey = fileKey;
    this.zodError = zodError;
  }
}

function getConfigDir(): string {
  return process.env.CONFIG_DIR ?? resolve(process.cwd(), 'config/runtime');
}

async function loadConfigFromDisk(configDir: string): Promise<AppConfig> {
  const loaded: Partial<AppConfig> = {};

  for (const key of CONFIG_KEYS) {
    const filePath = resolve(configDir, `${key}.yaml`);
    const raw = await readFile(filePath, 'utf8');
    const parsedYaml = loadYaml(raw);

    if (parsedYaml === null || parsedYaml === undefined || typeof parsedYaml !== 'object') {
      throw new Error(`Config parse failed in ${key}.yaml: expected object root`);
    }

    const schema = appConfigSchemas[key];
    const parsed = schema.safeParse(parsedYaml);
    if (!parsed.success) {
      throw new ConfigValidationError(key, parsed.error);
    }

    (loaded as Record<keyof AppConfig, unknown>)[key] = parsed.data;
  }

  return loaded as AppConfig;
}

function formatZodError(fileKey: keyof AppConfig, error: ZodError): string {
  const issue = error.issues[0];
  const issuePath = issue?.path?.length ? issue.path.join('.') : 'root';
  return `Config validation failed in ${fileKey}.yaml: ${fileKey}.${issuePath} - ${issue?.message ?? 'Unknown error'}`;
}

export async function initConfig(): Promise<void> {
  try {
    configCache = await loadConfigFromDisk(getConfigDir());
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      console.error(formatZodError(error.fileKey, error.zodError));
    } else {
      console.error(`Config initialization failed: ${(error as Error).message}`);
    }

    process.exit(1);
  }
}

export function getConfig(): AppConfig {
  if (configCache === null) {
    throw new Error('Configuration has not been initialized. Call initConfig() first.');
  }

  return configCache;
}

export async function reloadConfig(): Promise<{ changed: string[] }> {
  if (configCache === null) {
    throw new Error('Configuration has not been initialized. Call initConfig() first.');
  }

  const current = configCache;
  const next = await loadConfigFromDisk(getConfigDir());
  const changed = CONFIG_KEYS.filter((key) => JSON.stringify(current[key]) !== JSON.stringify(next[key]));

  configCache = next;

  return { changed };
}

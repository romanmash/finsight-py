import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { load as loadYaml } from 'js-yaml';
import type { z } from 'zod';

import { mcpConfigSchema, ragConfigSchema, traderConfigSchema, type McpConfig, type RagConfig, type TraderConfig } from '../../../../config/types/index.js';

export interface McpRuntimeConfig {
  mcp: McpConfig;
  rag: RagConfig;
  trader: TraderConfig;
}

function getConfigDir(): string {
  return process.env.CONFIG_DIR ?? resolve(process.cwd(), 'config/runtime');
}

async function loadYamlFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, 'utf8');
  return loadYaml(raw);
}

function parseWithSchema<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  value: unknown,
  fileName: string
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const issuePath = issue?.path?.length ? issue.path.join('.') : 'root';
    throw new Error(`Config validation failed in ${fileName}: ${issuePath} - ${issue?.message ?? 'Unknown error'}`);
  }

  return parsed.data;
}

export async function loadMcpRuntimeConfig(): Promise<McpRuntimeConfig> {
  const configDir = getConfigDir();

  const [mcpRaw, ragRaw, traderRaw] = await Promise.all([
    loadYamlFile(resolve(configDir, 'mcp.yaml')),
    loadYamlFile(resolve(configDir, 'rag.yaml')),
    loadYamlFile(resolve(configDir, 'trader.yaml'))
  ]);

  return {
    mcp: parseWithSchema(mcpConfigSchema, mcpRaw, 'mcp.yaml'),
    rag: parseWithSchema(ragConfigSchema, ragRaw, 'rag.yaml'),
    trader: parseWithSchema(traderConfigSchema, traderRaw, 'trader.yaml')
  };
}


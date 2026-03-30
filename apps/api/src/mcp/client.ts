import { z } from 'zod';

import type { McpConfig } from '../../../../config/types/index.js';
import { getConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import type { AgentToolRegistry, McpServerDefinition, ToolManifestEntry, ToolInvocationResultEnvelope } from '../types/agent-infrastructure.js';
import { invokeMcpTool } from './invoke.js';
import { buildAgentToolRegistry, buildServerToolRegistry } from './registry.js';

const TOOL_MANIFEST_SCHEMA = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
  outputSchema: z.record(z.string(), z.unknown()).optional()
}).passthrough();

const MCP_MANIFEST_RESPONSE_SCHEMA = z.object({
  tools: z.array(TOOL_MANIFEST_SCHEMA)
}).passthrough();

export interface InitializeMcpToolRegistryOptions {
  fetchImpl?: typeof fetch;
  startupBudgetMs?: number;
}

function toServerDefinitions(config: McpConfig): McpServerDefinition[] {
  const definitions: McpServerDefinition[] = [];

  for (const [name, server] of Object.entries(config.servers)) {
    definitions.push({
      name: name as McpServerDefinition['name'],
      url: server.url,
      timeoutMs: server.timeoutMs,
      required: server.required ?? true
    });
  }

  return definitions;
}

function getStartupBudgetMs(config: McpConfig, overrideMs?: number): number {
  if (overrideMs !== undefined) {
    return overrideMs;
  }

  const envBudget = process.env.MCP_STARTUP_BUDGET_MS;
  if (envBudget !== undefined) {
    const parsed = Number.parseInt(envBudget, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  if (config.invoke !== undefined) {
    return config.invoke.defaultTimeoutMs;
  }

  const firstServer = Object.values(config.servers)[0];
  if (firstServer !== undefined) {
    return firstServer.timeoutMs;
  }

  throw new Error('Cannot derive MCP startup readiness budget from configuration.');
}

async function fetchServerManifest(
  server: McpServerDefinition,
  fetchImpl: typeof fetch
): Promise<ToolManifestEntry[]> {
  const response = await fetchImpl(`${server.url}/mcp/tools`, {
    method: 'GET',
    signal: AbortSignal.timeout(server.timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`Manifest request failed with status ${String(response.status)}.`);
  }

  const parsed = MCP_MANIFEST_RESPONSE_SCHEMA.safeParse((await response.json()) as unknown);
  if (!parsed.success) {
    throw new Error(`Manifest schema validation failed: ${parsed.error.issues[0]?.message ?? 'unknown error'}`);
  }

  const entries: ToolManifestEntry[] = parsed.data.tools.map((tool) => {
    const entry: ToolManifestEntry = {
      name: tool.name,
      inputSchemaDescriptor: tool.inputSchema ?? {},
      outputSchemaDescriptor: tool.outputSchema ?? {},
      sourceServer: server.name
    };

    if (tool.description !== undefined) {
      entry.description = tool.description;
    }

    return entry;
  });

  return entries;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function invokeToolThroughServer(
  server: McpServerDefinition,
  toolName: string,
  input: unknown,
  fetchImpl: typeof fetch
): Promise<ToolInvocationResultEnvelope> {
  return invokeMcpTool(
    server,
    {
      tool: toolName,
      input
    },
    { fetchImpl }
  );
}

export async function initializeMcpToolRegistry(
  config: McpConfig,
  options?: InitializeMcpToolRegistryOptions
): Promise<AgentToolRegistry> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const serverDefinitions = toServerDefinitions(config);
  const startupBudgetMs = getStartupBudgetMs(config, options?.startupBudgetMs);

  const startedAt = Date.now();

  const initializationWork = Promise.all(
    serverDefinitions.map(async (server) => {
      try {
        const manifest = await fetchServerManifest(server, fetchImpl);
        logger.info({ serverName: server.name, toolCount: manifest.length }, 'Loaded MCP tool manifest');
        return { server, manifest };
      } catch (error) {
        if (server.required) {
          const message = `Required MCP server '${server.name}' failed readiness: ${(error as Error).message}`;
          logger.error({ serverName: server.name, error: (error as Error).message }, 'MCP startup readiness failed');
          throw new Error(message);
        }

        logger.warn(
          { serverName: server.name, error: (error as Error).message },
          'Optional MCP server unavailable at startup - skipping'
        );

        return null;
      }
    })
  );

  const allResults = await withTimeout(
    initializationWork,
    startupBudgetMs,
    `MCP startup readiness exceeded timeout budget (${String(startupBudgetMs)}ms).`
  );

  const manifestSets = allResults.filter((result): result is { server: McpServerDefinition; manifest: ToolManifestEntry[] } =>
    result !== null
  );

  const byServer: AgentToolRegistry['byServer'] = {};
  for (const { server, manifest } of manifestSets) {
    byServer[server.name] = buildServerToolRegistry(server, manifest, (definition, toolName, input) =>
      invokeToolThroughServer(definition, toolName, input, fetchImpl)
    );
  }

  const registry = buildAgentToolRegistry(byServer);

  logger.info(
    {
      serverCount: manifestSets.length,
      totalToolCount: Object.keys(registry.all).length,
      startupBudgetMs,
      durationMs: Date.now() - startedAt
    },
    'MCP tool registry initialized'
  );

  return registry;
}

export async function initializeMcpToolRegistryFromRuntime(options?: InitializeMcpToolRegistryOptions): Promise<AgentToolRegistry> {
  return initializeMcpToolRegistry(getConfig().mcp, options);
}

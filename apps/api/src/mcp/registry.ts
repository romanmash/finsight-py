import { logger } from '../lib/logger.js';
import type {
  AgentToolRegistry,
  McpServerDefinition,
  McpToolBinding,
  ToolManifestEntry,
  ToolInvocationResultEnvelope
} from '../types/agent-infrastructure.js';

export type ToolInvoker = (server: McpServerDefinition, toolName: string, input: unknown) => Promise<ToolInvocationResultEnvelope>;

export function buildServerToolRegistry(
  server: McpServerDefinition,
  tools: ToolManifestEntry[],
  invoker: ToolInvoker
): Record<string, McpToolBinding> {
  const registry: Record<string, McpToolBinding> = {};

  for (const tool of tools) {
    const binding: McpToolBinding = {
      name: tool.name,
      sourceServer: server.name,
      invoke: async (input: unknown): Promise<ToolInvocationResultEnvelope> => invoker(server, tool.name, input)
    };

    if (tool.description !== undefined) {
      binding.description = tool.description;
    }

    registry[tool.name] = binding;
  }

  logger.info({ serverName: server.name, toolCount: tools.length }, 'Built MCP per-server tool registry');

  return registry;
}

export function composeMergedToolRegistry(byServer: Record<string, Record<string, McpToolBinding>>): Record<string, McpToolBinding> {
  const merged: Record<string, McpToolBinding> = {};

  for (const [serverName, serverRegistry] of Object.entries(byServer)) {
    for (const [toolName, binding] of Object.entries(serverRegistry)) {
      if (merged[toolName] !== undefined) {
        const existing = merged[toolName];
        throw new Error(
          `Tool collision detected for '${toolName}' between servers '${existing.sourceServer}' and '${serverName}'.`
        );
      }

      merged[toolName] = binding;
    }
  }

  logger.info({ totalToolCount: Object.keys(merged).length }, 'Built merged MCP tool registry');

  return merged;
}

export function buildAgentToolRegistry(byServer: Record<string, Record<string, McpToolBinding>>): AgentToolRegistry {
  return {
    byServer,
    all: composeMergedToolRegistry(byServer),
    initializedAt: new Date().toISOString()
  };
}

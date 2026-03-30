import type { AgentToolRegistry } from '../types/agent-infrastructure.js';
import { initializeMcpToolRegistryFromRuntime, type InitializeMcpToolRegistryOptions } from './client.js';

let toolRegistry: AgentToolRegistry | null = null;

export async function initMcpInfrastructure(options?: InitializeMcpToolRegistryOptions): Promise<AgentToolRegistry> {
  toolRegistry = await initializeMcpToolRegistryFromRuntime(options);
  return toolRegistry;
}

export function getMcpToolRegistry(): AgentToolRegistry {
  if (toolRegistry === null) {
    throw new Error('MCP infrastructure is not initialized. Call initMcpInfrastructure() first.');
  }

  return toolRegistry;
}

export function resetMcpInfrastructureForTests(): void {
  toolRegistry = null;
}

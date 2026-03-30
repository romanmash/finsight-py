import { serve } from '@hono/node-server';

import { createMcpServer } from '../shared/create-mcp-server.js';
import { loadMcpRuntimeConfig } from '../shared/runtime-config.js';
import { createMacroSignalsToolRegistry } from './tools/index.js';

export async function createMacroSignalsServer(): Promise<import('hono').Hono> {
  const runtime = await loadMcpRuntimeConfig();

  return createMcpServer({
    serviceName: 'macro-signals-mcp',
    tools: createMacroSignalsToolRegistry(runtime.mcp)
  });
}

async function main(): Promise<void> {
  const app = await createMacroSignalsServer();
  const port = Number(process.env.MCP_MACRO_SIGNALS_PORT ?? 3002);
  serve({ fetch: app.fetch, port });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

import { serve } from '@hono/node-server';

import { createMcpServer } from '../shared/create-mcp-server.js';
import { loadMcpRuntimeConfig } from '../shared/runtime-config.js';
import { createMarketDataToolRegistry } from './tool-registry.js';

export async function createMarketDataServer(): Promise<import('hono').Hono> {
  const runtime = await loadMcpRuntimeConfig();

  return createMcpServer({
    serviceName: 'market-data-mcp',
    tools: createMarketDataToolRegistry(runtime.mcp)
  });
}

async function main(): Promise<void> {
  const app = await createMarketDataServer();
  const port = Number(process.env.MCP_MARKET_DATA_PORT ?? 3001);

  serve({ fetch: app.fetch, port });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

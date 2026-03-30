import { serve } from '@hono/node-server';

import { createMcpServer } from '../shared/create-mcp-server.js';
import { loadMcpRuntimeConfig } from '../shared/runtime-config.js';
import { createTraderPlatformToolRegistry } from './tools/index.js';

export async function createTraderPlatformServer(): Promise<import('hono').Hono> {
  const runtime = await loadMcpRuntimeConfig();
  const requireApprovalForNonMock = runtime.mcp.trader?.requireApprovalForNonMock ?? true;

  return createMcpServer({
    serviceName: 'trader-platform-mcp',
    tools: createTraderPlatformToolRegistry(runtime.trader, requireApprovalForNonMock)
  });
}

async function main(): Promise<void> {
  const app = await createTraderPlatformServer();
  const port = Number(process.env.MCP_TRADER_PLATFORM_PORT ?? 3006);
  serve({ fetch: app.fetch, port });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

import { serve } from '@hono/node-server';

import { createMcpServer } from '../shared/create-mcp-server.js';
import { loadMcpRuntimeConfig } from '../shared/runtime-config.js';
import { createNewsToolRegistry } from './tools/index.js';

export async function createNewsServer(): Promise<import('hono').Hono> {
  const runtime = await loadMcpRuntimeConfig();

  return createMcpServer({
    serviceName: 'news-mcp',
    tools: createNewsToolRegistry(runtime.mcp)
  });
}

async function main(): Promise<void> {
  const app = await createNewsServer();
  const port = Number(process.env.MCP_NEWS_PORT ?? 3003);
  serve({ fetch: app.fetch, port });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

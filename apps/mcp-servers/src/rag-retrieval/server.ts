import { serve } from '@hono/node-server';

import { createMcpServer } from '../shared/create-mcp-server.js';
import { loadMcpRuntimeConfig } from '../shared/runtime-config.js';
import { createRagRetrievalToolRegistry } from './tools/index.js';

export async function createRagRetrievalServer(): Promise<import('hono').Hono> {
  const runtime = await loadMcpRuntimeConfig();

  return createMcpServer({
    serviceName: 'rag-retrieval-mcp',
    tools: createRagRetrievalToolRegistry(runtime.mcp, runtime.rag)
  });
}

async function main(): Promise<void> {
  const app = await createRagRetrievalServer();
  const port = Number(process.env.MCP_RAG_RETRIEVAL_PORT ?? 3004);
  serve({ fetch: app.fetch, port });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

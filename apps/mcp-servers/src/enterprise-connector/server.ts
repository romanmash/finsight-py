import { serve } from '@hono/node-server';

import { createMcpServer } from '../shared/create-mcp-server.js';
import { createEnterpriseConnectorToolRegistry } from './tools/index.js';

export function createEnterpriseConnectorServer(): import('hono').Hono {
  return createMcpServer({
    serviceName: 'enterprise-connector-mcp',
    tools: createEnterpriseConnectorToolRegistry()
  });
}

function main(): void {
  const app = createEnterpriseConnectorServer();
  const port = Number(process.env.MCP_ENTERPRISE_CONNECTOR_PORT ?? 3005);
  serve({ fetch: app.fetch, port });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

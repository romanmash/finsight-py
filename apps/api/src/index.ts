import { serve } from '@hono/node-server';

import { createApp } from './app.js';
import { initConfig } from './lib/config.js';
import { initMcpInfrastructure } from './mcp/index.js';
import { initializeLocalProviderHealthMonitor } from './providers/lmstudio-health.js';

function getPort(): number {
  const value = process.env.PORT;
  if (value === undefined) {
    return 3000;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 3000 : parsed;
}

await initConfig();
await initMcpInfrastructure();
await initializeLocalProviderHealthMonitor();

const app = createApp();
const port = getPort();

serve({
  fetch: app.fetch,
  port
});

console.log(`API server listening on port ${String(port)}`);

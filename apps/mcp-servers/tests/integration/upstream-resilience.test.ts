import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { createMcpServer } from '../../src/shared/create-mcp-server.js';
import { createMarketDataToolRegistry } from '../../src/market-data/tool-registry.js';
import { mcpConfigFixture } from '../helpers/fixtures.js';
import { invokeTool } from '../helpers/test-app.js';
import { mswServer } from '../setup/msw.js';

describe('upstream resilience', () => {
  it('returns deterministic timeout/upstream envelope when providers fail', async () => {
    mswServer.use(
      http.get('https://market-data.test/quote', () => new HttpResponse(null, { status: 500 })),
      http.get('https://fmp.test/quote/NVDA', () => new HttpResponse(null, { status: 500 }))
    );

    const app = createMcpServer({
      serviceName: 'market-data-mcp',
      tools: createMarketDataToolRegistry(mcpConfigFixture)
    });

    const result = await invokeTool<{ error: { code: string } }>(app, {
      tool: 'get_quote',
      input: { ticker: 'NVDA' }
    });

    expect(result.status).toBeGreaterThanOrEqual(500);
    expect(['UPSTREAM_ERROR', 'INTERNAL_ERROR', 'TIMEOUT']).toContain(result.body.error.code);
  });
});


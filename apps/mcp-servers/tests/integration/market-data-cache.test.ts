import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { createMcpServer } from '../../src/shared/create-mcp-server.js';
import { createInMemoryCache } from '../../src/shared/cache.js';
import { createMarketDataToolRegistry } from '../../src/market-data/tool-registry.js';
import { mcpConfigFixture } from '../helpers/fixtures.js';
import { invokeTool } from '../helpers/test-app.js';
import { mswServer } from '../setup/msw.js';

describe('market-data cache', () => {
  it('returns cached quote for repeated calls within ttl', async () => {
    let calls = 0;
    mswServer.use(
      http.get('https://market-data.test/quote', () => {
        calls += 1;
        return HttpResponse.json({ c: 150, dp: 0.4, v: 5_000, h: 180, l: 100, pc: 300_000_000 });
      })
    );

    const app = createMcpServer({
      serviceName: 'market-data-mcp',
      tools: createMarketDataToolRegistry(mcpConfigFixture, { cache: createInMemoryCache() })
    });

    const first = await invokeTool<{ output: { price: number } }>(app, {
      tool: 'get_quote',
      input: { ticker: 'AAPL' }
    });

    const second = await invokeTool<{ output: { price: number } }>(app, {
      tool: 'get_quote',
      input: { ticker: 'AAPL' }
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.output.price).toBe(first.body.output.price);
    expect(calls).toBe(1);
  });
});

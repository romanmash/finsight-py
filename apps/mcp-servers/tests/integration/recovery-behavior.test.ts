import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { createMcpServer } from '../../src/shared/create-mcp-server.js';
import { createMarketDataToolRegistry } from '../../src/market-data/tool-registry.js';
import { mcpConfigFixture } from '../helpers/fixtures.js';
import { invokeTool } from '../helpers/test-app.js';
import { mswServer } from '../setup/msw.js';

describe('recovery behavior', () => {
  it('recovers from degraded upstream state when dependency becomes healthy', async () => {
    let finnhubCalls = 0;
    mswServer.use(
      http.get('https://market-data.test/quote', () => {
        finnhubCalls += 1;
        if (finnhubCalls <= 2) {
          return new HttpResponse(null, { status: 500 });
        }

        return HttpResponse.json({ c: 321, dp: 0.3, v: 4_000, h: 350, l: 250, pc: 900_000_000 });
      }),
      http.get('https://fmp.test/quote/RECOV', () => new HttpResponse(null, { status: 500 }))
    );

    const app = createMcpServer({
      serviceName: 'market-data-mcp',
      tools: createMarketDataToolRegistry(mcpConfigFixture)
    });

    const degraded = await invokeTool<{ error?: { code: string } }>(app, {
      tool: 'get_quote',
      input: { ticker: 'RECOV' }
    });

    expect(degraded.status).toBeGreaterThanOrEqual(500);

    const recovered = await invokeTool<{ output: { price: number } }>(app, {
      tool: 'get_quote',
      input: { ticker: 'RECOV' }
    });

    expect(recovered.status).toBe(200);
    expect(recovered.body.output.price).toBe(321);
  });
});


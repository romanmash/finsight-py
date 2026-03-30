import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { createMcpServer } from '../../src/shared/create-mcp-server.js';
import { createMarketDataToolRegistry } from '../../src/market-data/tool-registry.js';
import { mcpConfigFixture } from '../helpers/fixtures.js';
import { invokeTool } from '../helpers/test-app.js';
import { mswServer } from '../setup/msw.js';

describe('concurrency determinism', () => {
  it('returns deterministic envelopes under concurrent identical input', async () => {
    let calls = 0;
    mswServer.use(
      http.get('https://market-data.test/quote', () => {
        calls += 1;
        return HttpResponse.json({ c: 111, dp: 1.1, v: 1_000, h: 120, l: 90, pc: 100_000_000 });
      })
    );

    const app = createMcpServer({
      serviceName: 'market-data-mcp',
      tools: createMarketDataToolRegistry(mcpConfigFixture)
    });

    const requests = await Promise.all([
      invokeTool<{ output: { price: number } }>(app, { tool: 'get_quote', input: { ticker: 'AAPL' } }),
      invokeTool<{ output: { price: number } }>(app, { tool: 'get_quote', input: { ticker: 'AAPL' } }),
      invokeTool<{ output: { price: number } }>(app, { tool: 'get_quote', input: { ticker: 'AAPL' } })
    ]);

    expect(requests.every((row) => row.status === 200)).toBe(true);
    expect(requests.every((row) => row.body.output.price === 111)).toBe(true);
    expect(calls).toBe(1);
  });
});


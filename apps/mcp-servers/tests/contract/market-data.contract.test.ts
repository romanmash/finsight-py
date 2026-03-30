import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { createMcpServer } from '../../src/shared/create-mcp-server.js';
import { createMarketDataToolRegistry } from '../../src/market-data/tool-registry.js';
import { mcpConfigFixture } from '../helpers/fixtures.js';
import { invokeTool } from '../helpers/test-app.js';
import { mswServer } from '../setup/msw.js';

describe('market-data contract', () => {
  it('publishes required tools and supports quote invoke', async () => {
    mswServer.use(
      http.get('https://market-data.test/quote', () => HttpResponse.json({ c: 123, dp: 2.5, v: 10_000, h: 140, l: 90, pc: 500_000_000 }))
    );

    const app = createMcpServer({
      serviceName: 'market-data-mcp',
      tools: createMarketDataToolRegistry(mcpConfigFixture)
    });

    const tools = await app.request('/mcp/tools');
    const toolsBody = await tools.json() as { tools: Array<{ name: string }> };
    const toolNames = toolsBody.tools.map((tool) => tool.name);

    expect(toolNames).toEqual(expect.arrayContaining([
      'get_quote',
      'get_ohlcv',
      'get_fundamentals',
      'get_earnings',
      'get_multiple_quotes',
      'get_analyst_ratings',
      'get_price_targets'
    ]));

    const result = await invokeTool<{ output: { ticker: string; price: number } }>(app, {
      tool: 'get_quote',
      input: { ticker: 'NVDA' }
    });

    expect(result.status).toBe(200);
    expect(result.body.output.ticker).toBe('NVDA');
    expect(result.body.output.price).toBe(123);
  });
});


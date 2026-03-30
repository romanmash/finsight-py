import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { createMcpServer } from '../../src/shared/create-mcp-server.js';
import { createMacroSignalsToolRegistry } from '../../src/macro-signals/tools/index.js';
import { createNewsToolRegistry } from '../../src/news/tools/index.js';
import { mcpConfigFixture } from '../helpers/fixtures.js';
import { invokeTool } from '../helpers/test-app.js';
import { mswServer } from '../setup/msw.js';

describe('cache bypass behavior', () => {
  it('continues macro/news tool execution without Redis cache', async () => {
    delete process.env.REDIS_URL;    process.env.FINNHUB_API_KEY = 'test-token';

    mswServer.use(
      http.get('https://gdelt.test/doc/doc', () => HttpResponse.json({ timeline: [{ value: 3 }] })),
      http.get('https://news.test/company-news', () => HttpResponse.json([{ headline: 'Test', source: 'wire', datetime: 1_700_000_000, sentiment: 0.2 }]))
    );

    const macroApp = createMcpServer({
      serviceName: 'macro-signals-mcp',
      tools: createMacroSignalsToolRegistry(mcpConfigFixture)
    });

    const newsApp = createMcpServer({
      serviceName: 'news-mcp',
      tools: createNewsToolRegistry(mcpConfigFixture)
    });

    const macro = await invokeTool<{ output: { riskScore: number } }>(macroApp, { tool: 'get_gdelt_risk', input: { query: 'risk' } });
    const news = await invokeTool<{ output: { items: unknown[] } }>(newsApp, { tool: 'get_ticker_news', input: { ticker: 'NVDA' } });

    expect(macro.status).toBe(200);
    expect(news.status).toBe(200);
    expect(news.body.output.items.length).toBeGreaterThan(0);
  });
});


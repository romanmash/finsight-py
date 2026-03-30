import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { createMcpServer } from '../../src/shared/create-mcp-server.js';
import { createNewsToolRegistry } from '../../src/news/tools/index.js';
import { mcpConfigFixture } from '../helpers/fixtures.js';
import { invokeTool } from '../helpers/test-app.js';
import { mswServer } from '../setup/msw.js';

describe('news contract', () => {
  it('returns ticker news items', async () => {    process.env.FINNHUB_API_KEY = 'test-token';

    mswServer.use(
      http.get('https://news.test/company-news', () => HttpResponse.json([
        { headline: 'NVDA launches new platform', source: 'wire', datetime: 1_700_000_000, sentiment: 0.6 }
      ]))
    );

    const app = createMcpServer({
      serviceName: 'news-mcp',
      tools: createNewsToolRegistry(mcpConfigFixture)
    });

    const result = await invokeTool<{ output: { items: Array<{ headline: string }> } }>(app, {
      tool: 'get_ticker_news',
      input: { ticker: 'NVDA' }
    });

    expect(result.status).toBe(200);
    expect(result.body.output.items[0]?.headline).toContain('NVDA');
  });
});


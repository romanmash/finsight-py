import { describe, expect, it } from 'vitest';

import { createMcpServer } from '../../src/shared/create-mcp-server.js';
import { createTraderPlatformToolRegistry } from '../../src/trader-platform/tools/index.js';
import { traderConfigFixture } from '../helpers/fixtures.js';
import { invokeTool } from '../helpers/test-app.js';

describe('trader non-mock approval gating', () => {
  it('rejects non-mock order placement without approval context', async () => {
    process.env.MCP_TRADER_PLATFORM_MODE = 'saxo';

    const app = createMcpServer({
      serviceName: 'trader-platform-mcp',
      tools: createTraderPlatformToolRegistry(traderConfigFixture, true)
    });

    const created = await invokeTool<{ output: { ticketId: string } }>(app, {
      tool: 'create_ticket',
      input: {
        ticker: 'MSFT',
        action: 'buy',
        quantity: 1,
        rationale: 'Quality compounder',
        confidence: 'medium'
      }
    });

    const result = await invokeTool<{ error: { code: string } }>(app, {
      tool: 'place_order',
      input: {
        ticketId: created.body.output.ticketId
      }
    });

    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe('AUTHORIZATION_ERROR');
  });
});


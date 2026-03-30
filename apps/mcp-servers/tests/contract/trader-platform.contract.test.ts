import { describe, expect, it } from 'vitest';

import { createMcpServer } from '../../src/shared/create-mcp-server.js';
import { createTraderPlatformToolRegistry } from '../../src/trader-platform/tools/index.js';
import { traderConfigFixture } from '../helpers/fixtures.js';
import { invokeTool } from '../helpers/test-app.js';

describe('trader-platform contract', () => {
  it('supports ticket lifecycle in mock mode', async () => {
    process.env.MCP_TRADER_PLATFORM_MODE = 'mock';

    const app = createMcpServer({
      serviceName: 'trader-platform-mcp',
      tools: createTraderPlatformToolRegistry(traderConfigFixture, true)
    });

    const created = await invokeTool<{ output: { ticketId: string; status: string } }>(app, {
      tool: 'create_ticket',
      input: {
        ticker: 'NVDA',
        action: 'buy',
        quantity: 5,
        rationale: 'Earnings momentum',
        confidence: 'high'
      }
    });

    expect(created.status).toBe(200);
    const ticketId = created.body.output.ticketId;

    const placed = await invokeTool<{ output: { status: string } }>(app, {
      tool: 'place_order',
      input: {
        ticketId
      }
    });

    expect(placed.status).toBe(200);
    expect(['placed', 'filled']).toContain(placed.body.output.status);
  });
});


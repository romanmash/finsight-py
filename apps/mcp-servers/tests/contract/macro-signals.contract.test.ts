import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';

import { createMcpServer } from '../../src/shared/create-mcp-server.js';
import { createMacroSignalsToolRegistry } from '../../src/macro-signals/tools/index.js';
import { mcpConfigFixture } from '../helpers/fixtures.js';
import { invokeTool } from '../helpers/test-app.js';
import { mswServer } from '../setup/msw.js';

describe('macro-signals contract', () => {
  it('supports contract endpoints and gdelt invoke', async () => {
    mswServer.use(
      http.get('https://gdelt.test/doc/doc', () => HttpResponse.json({ timeline: [{ value: 12 }, { value: 8 }] }))
    );

    const app = createMcpServer({
      serviceName: 'macro-signals-mcp',
      tools: createMacroSignalsToolRegistry(mcpConfigFixture)
    });

    const result = await invokeTool<{ output: { riskScore: number } }>(app, {
      tool: 'get_gdelt_risk',
      input: { query: 'semiconductor export controls' }
    });

    expect(result.status).toBe(200);
    expect(result.body.output.riskScore).toBeGreaterThan(0);
  });
});


import { describe, expect, it } from 'vitest';

import { createSampleServer } from '../../src/shared/__fixtures__/sample-server.js';
import { invokeTool } from '../helpers/test-app.js';

describe('createMcpServer contracts', () => {
  it('exposes health and tools routes', async () => {
    const app = createSampleServer();

    const health = await app.request('/health');
    expect(health.status).toBe(200);

    const healthBody = await health.json() as { status: string; service: string; uptimeSeconds: number };
    expect(healthBody.status).toBe('ok');
    expect(healthBody.service).toBe('sample-mcp');
    expect(typeof healthBody.uptimeSeconds).toBe('number');

    const toolsResponse = await app.request('/mcp/tools');
    expect(toolsResponse.status).toBe(200);

    const toolsBody = await toolsResponse.json() as { tools: Array<{ name: string }> };
    expect(toolsBody.tools).toHaveLength(1);
    expect(toolsBody.tools[0]?.name).toBe('echo');
  });

  it('returns deterministic success envelope for invoke', async () => {
    const app = createSampleServer();
    const result = await invokeTool<{ output: { echoed: string }; durationMs: number }>(app, {
      tool: 'echo',
      input: { value: 'hello' }
    });

    expect(result.status).toBe(200);
    expect(result.body.output.echoed).toBe('hello');
    expect(typeof result.body.durationMs).toBe('number');
  });
});


import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createMcpServer } from '../../src/shared/create-mcp-server.js';
import { invokeTool } from '../helpers/test-app.js';

describe('createMcpServer errors', () => {
  it('returns 404 for unknown tool', async () => {
    const app = createMcpServer({
      serviceName: 'test-mcp',
      tools: []
    });

    const result = await invokeTool<{ error: { code: string } }>(app, { tool: 'missing', input: {} });
    expect(result.status).toBe(404);
    expect(result.body.error.code).toBe('TOOL_NOT_FOUND');
  });

  it('returns 400 for invalid input', async () => {
    const app = createMcpServer({
      serviceName: 'test-mcp',
      tools: [
        {
          name: 'requires_ticker',
          description: 'requires ticker',
          inputSchema: z.object({ ticker: z.string().min(1) }).strict(),
          outputSchema: z.object({ ok: z.boolean() }).strict(),
          handler: async (): Promise<{ ok: boolean }> => ({ ok: true })
        }
      ]
    });

    const result = await invokeTool<{ error: { code: string } }>(app, { tool: 'requires_ticker', input: {} });
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid output', async () => {
    const app = createMcpServer({
      serviceName: 'test-mcp',
      tools: [
        {
          name: 'invalid_output',
          description: 'bad output',
          inputSchema: z.object({}).strict(),
          outputSchema: z.object({ ok: z.boolean() }).strict(),
          handler: async (): Promise<{ ok: boolean }> => ({ nope: true } as unknown as { ok: boolean })
        }
      ]
    });

    const result = await invokeTool<{ error: { code: string } }>(app, { tool: 'invalid_output', input: {} });
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects duplicate tool registrations', () => {
    expect(() => createMcpServer({
      serviceName: 'test-mcp',
      tools: [
        {
          name: 'dupe',
          description: 'first',
          inputSchema: z.object({}).strict(),
          outputSchema: z.object({ ok: z.boolean() }).strict(),
          handler: async (): Promise<{ ok: boolean }> => ({ ok: true })
        },
        {
          name: 'dupe',
          description: 'second',
          inputSchema: z.object({}).strict(),
          outputSchema: z.object({ ok: z.boolean() }).strict(),
          handler: async (): Promise<{ ok: boolean }> => ({ ok: true })
        }
      ]
    })).toThrow();
  });
});



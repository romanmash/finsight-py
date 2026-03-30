import { describe, expect, it, vi } from 'vitest';

import type { McpConfig } from '../../../../../config/types/index.js';
import type { McpServerDefinition } from '../../types/agent-infrastructure.js';
import { initializeMcpToolRegistry } from '../../mcp/client.js';
import { invokeMcpTool } from '../../mcp/invoke.js';

function createMcpConfig(): McpConfig {
  return {
    invoke: {
      defaultTimeoutMs: 500,
      defaultRetry: {
        maxAttempts: 2,
        backoffMs: 50
      }
    },
    providers: {
      marketDataBaseUrl: 'https://example.com/market',
      fmpBaseUrl: 'https://example.com/fmp',
      gdeltBaseUrl: 'https://example.com/gdelt',
      alphaVantageBaseUrl: 'https://example.com/alpha',
      newsBaseUrl: 'https://example.com/news'
    },
    localProvider: {
      baseUrl: 'http://localhost:1234',
      healthProbeIntervalMs: 300000,
      healthProbeTimeoutMs: 2000
    },
    servers: {
      marketData: { url: 'http://market-data', timeoutMs: 1000, required: true },
      macroSignals: { url: 'http://macro-signals', timeoutMs: 1000, required: true },
      news: { url: 'http://news', timeoutMs: 1000, required: true },
      ragRetrieval: { url: 'http://rag-retrieval', timeoutMs: 1000, required: true },
      enterpriseConnector: { url: 'http://enterprise-connector', timeoutMs: 1000, required: true },
      traderPlatform: { url: 'http://trader-platform', timeoutMs: 1000, required: true }
    }
  };
}

function createServer(name: McpServerDefinition['name']): McpServerDefinition {
  return {
    name,
    url: `http://${name}`,
    timeoutMs: 1000,
    required: true
  };
}

function asResponse(value: Partial<Response>): Response {
  return value as Response;
}

describe('mcp client infrastructure', () => {
  it('loads manifests and builds per-server + merged registries', async (): Promise<void> => {
    const fetchMock = vi.fn(async (url: string): Promise<Response> => {
      if (url.endsWith('/mcp/tools')) {
        const host = new URL(url).host;
        return asResponse({
          ok: true,
          status: 200,
          json: async (): Promise<unknown> => ({
            tools: [
              {
                name: `tool_${host.replace(/-/g, '_')}`,
                description: 'Tool',
                inputSchema: { type: 'object' },
                outputSchema: { type: 'object' }
              }
            ]
          })
        });
      }

      return asResponse({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => ({ output: { ok: true }, durationMs: 1 })
      });
    });

    const registry = await initializeMcpToolRegistry(createMcpConfig(), {
      fetchImpl: fetchMock as unknown as typeof fetch,
      startupBudgetMs: 1000
    });

    expect(Object.keys(registry.byServer)).toHaveLength(6);
    expect(Object.keys(registry.all)).toHaveLength(6);
  });

  it('fails when merged registry has duplicate tool names', async (): Promise<void> => {
    const fetchMock = vi.fn(async (): Promise<Response> =>
      asResponse({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => ({
          tools: [{ name: 'duplicate_tool', inputSchema: {}, outputSchema: {} }]
        })
      })
    );

    await expect(
      initializeMcpToolRegistry(createMcpConfig(), {
        fetchImpl: fetchMock as unknown as typeof fetch,
        startupBudgetMs: 1000
      })
    ).rejects.toThrow('Tool collision detected');
  });

  it('returns structured invocation success and failure envelopes', async (): Promise<void> => {
    const successFetch = vi.fn(async (): Promise<Response> =>
      asResponse({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => ({ output: { ticker: 'NVDA' }, durationMs: 10 })
      })
    );

    const success = await invokeMcpTool(
      createServer('marketData'),
      { tool: 'get_quote', input: { ticker: 'NVDA' } },
      { fetchImpl: successFetch as unknown as typeof fetch }
    );

    expect('output' in success).toBe(true);

    const failureFetch = vi.fn(async (): Promise<Response> =>
      asResponse({
        ok: false,
        status: 503,
        json: async (): Promise<unknown> => ({ message: 'down' })
      })
    );

    const failure = await invokeMcpTool(
      createServer('marketData'),
      { tool: 'get_quote', input: { ticker: 'NVDA' } },
      { fetchImpl: failureFetch as unknown as typeof fetch }
    );

    expect('error' in failure).toBe(true);
    if ('error' in failure) {
      expect(failure.error.code).toBe('UPSTREAM_ERROR');
      expect(failure.error.sourceServer).toBe('marketData');
    }
  });

  it('enforces startup timeout budget for readiness failures', async (): Promise<void> => {
    const delayedFetch = vi.fn(async (): Promise<Response> => {
      return new Promise<Response>((resolve) => {
        setTimeout(() => {
          resolve(
            asResponse({
              ok: true,
              status: 200,
              json: async (): Promise<unknown> => ({ tools: [{ name: 'tool_a', inputSchema: {}, outputSchema: {} }] })
            })
          );
        }, 50);
      });
    });

    await expect(
      initializeMcpToolRegistry(createMcpConfig(), {
        fetchImpl: delayedFetch as unknown as typeof fetch,
        startupBudgetMs: 10
      })
    ).rejects.toThrow('startup readiness exceeded timeout budget');
  });

  it('skips optional MCP servers that fail readiness while keeping required servers', async (): Promise<void> => {
    const config = createMcpConfig();
    config.servers.enterpriseConnector.required = false;

    const fetchMock = vi.fn(async (url: string): Promise<Response> => {
      if (url.includes('enterprise-connector')) {
        throw new Error('connection refused');
      }

      return asResponse({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => ({
          tools: [{ name: `tool_${new URL(url).host}`, inputSchema: {}, outputSchema: {} }]
        })
      });
    });

    const registry = await initializeMcpToolRegistry(config, {
      fetchImpl: fetchMock as unknown as typeof fetch,
      startupBudgetMs: 1000
    });

    expect(registry.byServer.enterpriseConnector).toBeUndefined();
    expect(Object.keys(registry.byServer)).toHaveLength(5);
  });

  it('returns structured validation error envelope for invalid invoke payloads', async (): Promise<void> => {
    const response = await invokeMcpTool(
      createServer('marketData'),
      { tool: 'get_quote' },
      { fetchImpl: vi.fn() as unknown as typeof fetch }
    );

    expect('error' in response).toBe(true);
    if ('error' in response) {
      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect(response.error.sourceServer).toBe('marketData');
      expect(response.error.retryable).toBe(false);
    }
  });
  it('maps invalid JSON invoke responses to validation-error envelope', async (): Promise<void> => {
    const invalidJsonFetch = vi.fn(async (): Promise<Response> =>
      asResponse({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => {
          throw new SyntaxError('Unexpected token < in JSON');
        }
      })
    );

    const response = await invokeMcpTool(
      createServer('marketData'),
      { tool: 'get_quote', input: { ticker: 'NVDA' } },
      { fetchImpl: invalidJsonFetch as unknown as typeof fetch }
    );

    expect('error' in response).toBe(true);
    if ('error' in response) {
      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect(response.error.retryable).toBe(false);
      expect(response.error.sourceServer).toBe('marketData');
    }
  });
});

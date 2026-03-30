import { describe, expect, it } from 'vitest';

import { createMcpServer } from '../../src/shared/create-mcp-server.js';
import { createRagRetrievalToolRegistry } from '../../src/rag-retrieval/tools/index.js';
import type { RetrievalRepository } from '../../src/rag-retrieval/repository.js';
import { mcpConfigFixture, ragConfigFixture } from '../helpers/fixtures.js';
import { invokeTool } from '../helpers/test-app.js';

const repositoryFixture: RetrievalRepository = {
  async search() {
    return [
      {
        id: 'kb-1',
        ticker: 'NVDA',
        entryType: 'thesis',
        summary: 'Cloud and AI demand remains strong.',
        createdAt: '2026-03-30T00:00:00.000Z',
        scoreBase: 0.9
      }
    ];
  },
  async getCurrentThesis(ticker) {
    return {
      ticker,
      thesis: 'Maintain overweight with risk controls.',
      confidence: 'high',
      updatedAt: '2026-03-30T00:00:00.000Z'
    };
  },
  async getThesisHistory() {
    return [
      {
        id: 'th-1',
        thesis: 'Initial thesis',
        confidence: 'medium',
        createdAt: '2026-03-20T00:00:00.000Z'
      }
    ];
  }
};

describe('rag-retrieval contract', () => {
  it('supports search/current/history tools', async () => {
    const app = createMcpServer({
      serviceName: 'rag-retrieval-mcp',
      tools: createRagRetrievalToolRegistry(mcpConfigFixture, ragConfigFixture, { repository: repositoryFixture })
    });

    const search = await invokeTool<{ output: { items: Array<{ id: string }> } }>(app, {
      tool: 'search',
      input: { query: 'cloud', limit: 5 }
    });

    expect(search.status).toBe(200);
    expect(Array.isArray(search.body.output.items)).toBe(true);

    const current = await invokeTool<{ output: { ticker: string } | null }>(app, {
      tool: 'get_current_thesis',
      input: { ticker: 'NVDA' }
    });

    expect(current.status).toBe(200);
    expect(current.body.output?.ticker).toBe('NVDA');

    const history = await invokeTool<{ output: { ticker: string; items: unknown[] } }>(app, {
      tool: 'get_thesis_history',
      input: { ticker: 'NVDA' }
    });

    expect(history.status).toBe(200);
    expect(history.body.output.ticker).toBe('NVDA');
  });
});


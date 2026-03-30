import { describe, expect, it } from 'vitest';

import { createMcpServer } from '../../src/shared/create-mcp-server.js';
import { createEnterpriseConnectorToolRegistry } from '../../src/enterprise-connector/tools/index.js';
import { invokeTool } from '../helpers/test-app.js';

describe('enterprise-connector contract', () => {
  it('returns repository artifacts for sharepoint and email search', async () => {
    const app = createMcpServer({
      serviceName: 'enterprise-connector-mcp',
      tools: createEnterpriseConnectorToolRegistry({
        repository: {
          search: async ({ sourceType, ticker }: { sourceType: 'sharepoint' | 'email'; query: string; ticker?: string }) => {
            if (sourceType === 'sharepoint') {
              return [{
                id: 'doc-001',
                sourceType: 'sharepoint',
                title: 'Supply chain update',
                excerpt: 'Lead times improving for advanced packaging.',
                timestamp: '2026-03-27T10:00:00.000Z',
                owner: 'ops@finsight.local',
                ticker: ticker ?? 'NVDA'
              }];
            }

            return [{
              id: 'mail-001',
              sourceType: 'email',
              title: 'Inventory note',
              excerpt: 'Inventory surprise may pressure refiners.',
              timestamp: '2026-03-25T10:00:00.000Z',
              owner: 'analyst@finsight.local',
              ticker: ticker ?? 'XOM'
            }];
          }
        }
      })
    });

    const sharepoint = await invokeTool<{ output: { items: Array<{ sourceType: string }> } }>(app, {
      tool: 'sharepoint_search',
      input: { query: 'supply', ticker: 'NVDA' }
    });

    expect(sharepoint.status).toBe(200);
    expect(sharepoint.body.output.items[0]?.sourceType).toBe('sharepoint');

    const emails = await invokeTool<{ output: { items: Array<{ sourceType: string }> } }>(app, {
      tool: 'search_emails',
      input: { query: 'inventory' }
    });

    expect(emails.status).toBe(200);
    expect(emails.body.output.items[0]?.sourceType).toBe('email');
  });
});

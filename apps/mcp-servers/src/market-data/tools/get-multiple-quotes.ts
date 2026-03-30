import type { McpToolDefinition } from '../../shared/tool-types.js';

import type { MarketDataDeps } from './deps.js';
import { createGetQuoteTool } from './get-quote.js';
import { multipleQuotesInputSchema, multipleQuotesOutputSchema, type MultipleQuotesInput } from './schemas.js';

export function createGetMultipleQuotesTool(deps: MarketDataDeps): McpToolDefinition<MultipleQuotesInput, { quotes: Record<string, { ticker: string; price: number; change_pct: number; volume: number; market_cap: number; high_52w: number; low_52w: number }> }> {
  const quoteTool = createGetQuoteTool(deps);

  return {
    name: 'get_multiple_quotes',
    description: 'Get quotes for multiple tickers',
    inputSchema: multipleQuotesInputSchema,
    outputSchema: multipleQuotesOutputSchema,
    handler: async (input, context): Promise<{ quotes: Record<string, { ticker: string; price: number; change_pct: number; volume: number; market_cap: number; high_52w: number; low_52w: number }> }> => {
      const entries = await Promise.all(
        input.tickers.map(async (ticker) => {
          const output = await quoteTool.handler({ ticker }, context);
          return [ticker, output] as const;
        })
      );

      return {
        quotes: Object.fromEntries(entries)
      };
    }
  };
}



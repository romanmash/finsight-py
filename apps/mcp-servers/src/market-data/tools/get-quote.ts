import { buildCacheKey, withCache } from '../../shared/cache.js';
import type { McpToolDefinition } from '../../shared/tool-types.js';

import type { MarketDataDeps } from './deps.js';
import { getCacheTtl, getRequestPolicy, withProviderFallback } from './deps.js';
import { quoteOutputSchema, tickerInputSchema, type TickerInput } from './schemas.js';

export function createGetQuoteTool(deps: MarketDataDeps): McpToolDefinition<TickerInput, { ticker: string; price: number; change_pct: number; volume: number; market_cap: number; high_52w: number; low_52w: number }> {
  return {
    name: 'get_quote',
    description: 'Get current quote for a ticker',
    inputSchema: tickerInputSchema,
    outputSchema: quoteOutputSchema,
    handler: async (input): Promise<{ ticker: string; price: number; change_pct: number; volume: number; market_cap: number; high_52w: number; low_52w: number }> => {
      const policy = getRequestPolicy(deps.config);
      const ttlSeconds = getCacheTtl(deps.config, 'quoteTtlSec');
      const cacheKey = buildCacheKey('get_quote', input);

      return await withCache({
        cache: deps.cache,
        key: cacheKey,
        ttlSeconds,
        logger: deps.logger,
        fetcher: async () => {
          const quote = await withProviderFallback(
            async () => await deps.finnhubClient.getQuote(input.ticker, policy),
            async () => await deps.fmpClient.getQuote(input.ticker, policy)
          );

          return {
            ticker: input.ticker,
            price: quote.price,
            change_pct: quote.changePct,
            volume: quote.volume,
            market_cap: quote.marketCap,
            high_52w: quote.high52w,
            low_52w: quote.low52w
          };
        }
      });
    }
  };
}



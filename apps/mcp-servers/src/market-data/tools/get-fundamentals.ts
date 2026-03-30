import { buildCacheKey, withCache } from '../../shared/cache.js';
import type { McpToolDefinition } from '../../shared/tool-types.js';

import type { MarketDataDeps } from './deps.js';
import { getCacheTtl, getRequestPolicy, withProviderFallback } from './deps.js';
import { fundamentalsOutputSchema, tickerInputSchema, type TickerInput } from './schemas.js';

export function createGetFundamentalsTool(deps: MarketDataDeps): McpToolDefinition<TickerInput, { ticker: string; pe_ratio: number | null; eps: number | null; revenue_growth_yoy: number | null; debt_to_equity: number | null; sector: string }> {
  return {
    name: 'get_fundamentals',
    description: 'Get fundamentals for a ticker',
    inputSchema: tickerInputSchema,
    outputSchema: fundamentalsOutputSchema,
    handler: async (input): Promise<{ ticker: string; pe_ratio: number | null; eps: number | null; revenue_growth_yoy: number | null; debt_to_equity: number | null; sector: string }> => {
      const policy = getRequestPolicy(deps.config);
      const ttlSeconds = getCacheTtl(deps.config, 'fundamentalsTtlSec');
      const cacheKey = buildCacheKey('get_fundamentals', input);

      return await withCache({
        cache: deps.cache,
        key: cacheKey,
        ttlSeconds,
        logger: deps.logger,
        fetcher: async () => {
          const fundamentals = await withProviderFallback(
            async () => await deps.fmpClient.getFundamentals(input.ticker, policy),
            async () => await deps.finnhubClient.getFundamentals(input.ticker, policy)
          );

          return {
            ticker: input.ticker,
            pe_ratio: fundamentals.peRatio,
            eps: fundamentals.eps,
            revenue_growth_yoy: fundamentals.revenueGrowthYoy,
            debt_to_equity: fundamentals.debtToEquity,
            sector: fundamentals.sector
          };
        }
      });
    }
  };
}



import { buildCacheKey, withCache } from '../../shared/cache.js';
import type { McpToolDefinition } from '../../shared/tool-types.js';

import type { MarketDataDeps } from './deps.js';
import { getCacheTtl, getRequestPolicy, withProviderFallback } from './deps.js';
import { analystRatingsOutputSchema, tickerInputSchema, type TickerInput } from './schemas.js';

export function createGetAnalystRatingsTool(deps: MarketDataDeps): McpToolDefinition<TickerInput, { ticker: string; strong_buy: number; buy: number; hold: number; sell: number; strong_sell: number; period: string }> {
  return {
    name: 'get_analyst_ratings',
    description: 'Get analyst recommendation distribution',
    inputSchema: tickerInputSchema,
    outputSchema: analystRatingsOutputSchema,
    handler: async (input): Promise<{ ticker: string; strong_buy: number; buy: number; hold: number; sell: number; strong_sell: number; period: string }> => {
      const policy = getRequestPolicy(deps.config);
      const ttlSeconds = getCacheTtl(deps.config, 'ratingsTtlSec');
      const cacheKey = buildCacheKey('get_analyst_ratings', input);

      return await withCache({
        cache: deps.cache,
        key: cacheKey,
        ttlSeconds,
        logger: deps.logger,
        fetcher: async () => {
          const ratings = await withProviderFallback(
            async () => await deps.finnhubClient.getAnalystRatings(input.ticker, policy),
            async () => await deps.fmpClient.getAnalystRatings(input.ticker, policy)
          );

          return {
            ticker: input.ticker,
            strong_buy: ratings.strongBuy,
            buy: ratings.buy,
            hold: ratings.hold,
            sell: ratings.sell,
            strong_sell: ratings.strongSell,
            period: ratings.period
          };
        }
      });
    }
  };
}



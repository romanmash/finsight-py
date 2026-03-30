import { buildCacheKey, withCache } from '../../shared/cache.js';
import type { McpToolDefinition } from '../../shared/tool-types.js';

import type { MarketDataDeps } from './deps.js';
import { getCacheTtl, getRequestPolicy, withProviderFallback } from './deps.js';
import { earningsOutputSchema, tickerInputSchema, type TickerInput } from './schemas.js';

function calculateDaysUntil(nextDate: string | null): number | null {
  if (!nextDate) {
    return null;
  }

  const now = new Date();
  const target = new Date(nextDate);
  const diffMs = target.getTime() - now.getTime();

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function createGetEarningsTool(deps: MarketDataDeps): McpToolDefinition<TickerInput, { ticker: string; next_date: string | null; days_until: number | null; estimate_eps: number | null; prev_eps: number | null; surprise_pct_last: number | null }> {
  return {
    name: 'get_earnings',
    description: 'Get earnings preview for a ticker',
    inputSchema: tickerInputSchema,
    outputSchema: earningsOutputSchema,
    handler: async (input): Promise<{ ticker: string; next_date: string | null; days_until: number | null; estimate_eps: number | null; prev_eps: number | null; surprise_pct_last: number | null }> => {
      const policy = getRequestPolicy(deps.config);
      const ttlSeconds = getCacheTtl(deps.config, 'earningsTtlSec');
      const cacheKey = buildCacheKey('get_earnings', input);

      return await withCache({
        cache: deps.cache,
        key: cacheKey,
        ttlSeconds,
        logger: deps.logger,
        fetcher: async () => {
          const earnings = await withProviderFallback(
            async () => await deps.finnhubClient.getEarnings(input.ticker, policy),
            async () => await deps.fmpClient.getEarnings(input.ticker, policy)
          );

          return {
            ticker: input.ticker,
            next_date: earnings.nextDate,
            days_until: calculateDaysUntil(earnings.nextDate),
            estimate_eps: earnings.estimateEps,
            prev_eps: earnings.prevEps,
            surprise_pct_last: earnings.surprisePctLast
          };
        }
      });
    }
  };
}



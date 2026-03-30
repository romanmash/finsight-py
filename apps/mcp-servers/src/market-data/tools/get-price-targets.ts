import type { McpToolDefinition } from '../../shared/tool-types.js';

import type { MarketDataDeps } from './deps.js';
import { getRequestPolicy, withProviderFallback } from './deps.js';
import { priceTargetsOutputSchema, tickerInputSchema, type TickerInput } from './schemas.js';

export function createGetPriceTargetsTool(deps: MarketDataDeps): McpToolDefinition<TickerInput, { ticker: string; avg_target: number; high_target: number; low_target: number; analyst_count: number }> {
  return {
    name: 'get_price_targets',
    description: 'Get analyst price targets',
    inputSchema: tickerInputSchema,
    outputSchema: priceTargetsOutputSchema,
    handler: async (input): Promise<{ ticker: string; avg_target: number; high_target: number; low_target: number; analyst_count: number }> => {
      const policy = getRequestPolicy(deps.config);
      const targets = await withProviderFallback(
        async () => await deps.fmpClient.getPriceTargets(input.ticker, policy),
        async () => await deps.finnhubClient.getPriceTargets(input.ticker, policy)
      );

      return {
        ticker: input.ticker,
        avg_target: targets.avgTarget,
        high_target: targets.highTarget,
        low_target: targets.lowTarget,
        analyst_count: targets.analystCount
      };
    }
  };
}



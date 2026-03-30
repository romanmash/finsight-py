import type { McpToolDefinition } from '../../shared/tool-types.js';

import type { MarketDataDeps } from './deps.js';
import { getRequestPolicy, withProviderFallback } from './deps.js';
import { ohlcvInputSchema, ohlcvOutputSchema, type OhlcvInput } from './schemas.js';

export function createGetOhlcvTool(deps: MarketDataDeps): McpToolDefinition<OhlcvInput, { ticker: string; candles: Array<{ o: number; h: number; l: number; c: number; v: number; t: number }> }> {
  return {
    name: 'get_ohlcv',
    description: 'Get OHLCV candles for a ticker',
    inputSchema: ohlcvInputSchema,
    outputSchema: ohlcvOutputSchema,
    handler: async (input): Promise<{ ticker: string; candles: Array<{ o: number; h: number; l: number; c: number; v: number; t: number }> }> => {
      const policy = getRequestPolicy(deps.config);
      const candles = await withProviderFallback(
        async () => await deps.finnhubClient.getOhlcv(
          input.ticker,
          {
            from: input.fromUnixSec,
            to: input.toUnixSec,
            resolution: input.resolution
          },
          policy
        ),
        async () => await deps.fmpClient.getOhlcv(input.ticker, policy)
      );

      return {
        ticker: input.ticker,
        candles
      };
    }
  };
}



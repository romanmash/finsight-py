import pino from 'pino';

import type { McpConfig } from '../../../../config/types/index.js';
import { createCache, type CacheBackend } from '../shared/cache.js';
import type { McpAnyToolDefinition } from '../shared/tool-types.js';
import { FmpClient } from './providers/fmp-client.js';
import { FinnhubClient } from './providers/finnhub-client.js';
import type { MarketDataDeps } from './tools/deps.js';
import { createGetAnalystRatingsTool } from './tools/get-analyst-ratings.js';
import { createGetEarningsTool } from './tools/get-earnings.js';
import { createGetFundamentalsTool } from './tools/get-fundamentals.js';
import { createGetMultipleQuotesTool } from './tools/get-multiple-quotes.js';
import { createGetOhlcvTool } from './tools/get-ohlcv.js';
import { createGetPriceTargetsTool } from './tools/get-price-targets.js';
import { createGetQuoteTool } from './tools/get-quote.js';

interface MarketDataToolRegistryOptions {
  cache?: CacheBackend;
}

export function createMarketDataToolRegistry(
  config: McpConfig,
  options: MarketDataToolRegistryOptions = {}
): ReadonlyArray<McpAnyToolDefinition> {
  const logger = pino({ level: process.env.LOG_LEVEL ?? 'info', name: 'market-data-mcp' });
  const cache = options.cache ?? createCache(process.env.REDIS_URL ? { redisUrl: process.env.REDIS_URL, logger } : { logger });

  const deps: MarketDataDeps = {
    logger,
    cache,
    config,
    finnhubClient: new FinnhubClient({
      baseUrl: config.providers.marketDataBaseUrl,
      apiKey: process.env.FINNHUB_API_KEY
    }),
    fmpClient: new FmpClient({
      baseUrl: config.providers.fmpBaseUrl,
      apiKey: process.env.FMP_API_KEY
    })
  };

  return [
    createGetQuoteTool(deps) as McpAnyToolDefinition,
    createGetOhlcvTool(deps) as McpAnyToolDefinition,
    createGetFundamentalsTool(deps) as McpAnyToolDefinition,
    createGetEarningsTool(deps) as McpAnyToolDefinition,
    createGetMultipleQuotesTool(deps) as McpAnyToolDefinition,
    createGetAnalystRatingsTool(deps) as McpAnyToolDefinition,
    createGetPriceTargetsTool(deps) as McpAnyToolDefinition
  ];
}

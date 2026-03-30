import type pino from 'pino';

import type { McpConfig } from '../../../../../config/types/index.js';
import type { CacheBackend } from '../../shared/cache.js';
import type { FmpClient } from '../providers/fmp-client.js';
import type { FinnhubClient, RequestPolicy } from '../providers/finnhub-client.js';

export interface MarketDataDeps {
  logger: pino.Logger;
  cache: CacheBackend;
  config: McpConfig;
  finnhubClient: FinnhubClient;
  fmpClient: FmpClient;
}

export function getRequestPolicy(config: McpConfig): RequestPolicy {
  const server = config.servers.marketData;
  const fallback = config.invoke?.defaultRetry;

  return {
    timeoutMs: server.timeoutMs,
    maxAttempts: server.retry?.maxAttempts ?? fallback?.maxAttempts ?? 1,
    backoffMs: server.retry?.backoffMs ?? fallback?.backoffMs ?? 0
  };
}

export function getCacheTtl(config: McpConfig, key: 'quoteTtlSec' | 'fundamentalsTtlSec' | 'earningsTtlSec' | 'ratingsTtlSec'): number {
  return config.servers.marketData.cache?.[key] ?? 0;
}

export async function withProviderFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await primary();
  } catch {
    return await fallback();
  }
}

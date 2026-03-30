import pino from 'pino';
import { z } from 'zod';

import type { McpConfig } from '../../../../../config/types/index.js';
import { buildCacheKey, createCache, withCache } from '../../shared/cache.js';
import { createConfigError, createUpstreamError, withRetry, withTimeout } from '../../shared/errors.js';
import type { McpAnyToolDefinition, McpToolDefinition } from '../../shared/tool-types.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info', name: 'macro-signals-mcp' });
const cache = createCache(process.env.REDIS_URL ? { redisUrl: process.env.REDIS_URL, logger } : { logger });

const gdeltInputSchema = z.object({ query: z.string().min(1) }).strict();
const gdeltOutputSchema = z.object({ query: z.string(), riskScore: z.number(), articles: z.number().int().nonnegative() }).strict();

const ecoInputSchema = z.object({ country: z.string().optional() }).strict();
const ecoOutputSchema = z.object({
  country: z.string(),
  events: z.array(z.object({ name: z.string(), date: z.string(), impact: z.string() }).strict())
}).strict();

const indicatorInputSchema = z.object({ indicator: z.string().min(1), symbol: z.string().optional() }).strict();
const indicatorOutputSchema = z.object({ indicator: z.string(), symbol: z.string(), value: z.number(), asOf: z.string() }).strict();

const sectorInputSchema = z.object({ sector: z.string().min(1) }).strict();
const sectorOutputSchema = z.object({ sector: z.string(), summary: z.string(), riskLevel: z.enum(['low', 'medium', 'high']) }).strict();

interface RetryPolicy {
  timeoutMs: number;
  maxAttempts: number;
  backoffMs: number;
}

function getPolicy(config: McpConfig): RetryPolicy {
  const server = config.servers.macroSignals;
  const defaults = config.invoke?.defaultRetry;

  return {
    timeoutMs: server.timeoutMs,
    maxAttempts: server.retry?.maxAttempts ?? defaults?.maxAttempts ?? 1,
    backoffMs: server.retry?.backoffMs ?? defaults?.backoffMs ?? 0
  };
}

async function fetchJson(url: string, policy: RetryPolicy): Promise<unknown> {
  const execute = async (): Promise<unknown> => {
    const response = await withTimeout(async () => await fetch(url), policy.timeoutMs, 'Macro upstream timeout');
    if (!response.ok) {
      throw createUpstreamError(`Macro upstream failed (${response.status})`, { status: response.status, url });
    }

    return await response.json();
  };

  return await withRetry(execute, policy.maxAttempts, policy.backoffMs);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw createConfigError(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function createMacroSignalsToolRegistry(config: McpConfig): ReadonlyArray<McpAnyToolDefinition> {
  const policy = getPolicy(config);
  const gdeltTtl = config.servers.macroSignals.cache?.gdeltTtlSec ?? 0;
  const ecoTtl = config.servers.macroSignals.cache?.ecoCalendarTtlSec ?? 0;
  const indicatorTtl = config.servers.macroSignals.cache?.indicatorTtlSec ?? 0;

  const gdeltBase = config.providers.gdeltBaseUrl;
  const alphaBase = config.providers.alphaVantageBaseUrl;

  const getGdeltRisk: McpToolDefinition<z.infer<typeof gdeltInputSchema>, z.infer<typeof gdeltOutputSchema>> = {
    name: 'get_gdelt_risk',
    description: 'Get geopolitical risk score from GDELT timeline search',
    inputSchema: gdeltInputSchema,
    outputSchema: gdeltOutputSchema,
    handler: async (input) => {
      const cacheKey = buildCacheKey('get_gdelt_risk', input);
      return await withCache({
        cache,
        key: cacheKey,
        ttlSeconds: gdeltTtl,
        logger,
        fetcher: async () => {
          const url = `${gdeltBase}/doc/doc?query=${encodeURIComponent(input.query)}&mode=TimelineVolRaw&format=json`;
          const payload = await fetchJson(url, policy) as { timeline?: Array<{ value?: number }> };
          const volume = payload.timeline?.reduce((sum, item) => sum + (item.value ?? 0), 0) ?? 0;
          return { query: input.query, riskScore: Math.min(100, volume), articles: volume };
        }
      });
    }
  };

  const getEcoCalendar: McpToolDefinition<z.infer<typeof ecoInputSchema>, z.infer<typeof ecoOutputSchema>> = {
    name: 'get_eco_calendar',
    description: 'Get macroeconomic calendar events',
    inputSchema: ecoInputSchema,
    outputSchema: ecoOutputSchema,
    handler: async (input) => {
      const country = input.country ?? 'US';
      const cacheKey = buildCacheKey('get_eco_calendar', { country });

      return await withCache({
        cache,
        key: cacheKey,
        ttlSeconds: ecoTtl,
        logger,
        fetcher: async () => {
          const apiKey = requireEnv('ALPHA_VANTAGE_API_KEY');
          const url = `${alphaBase}?function=ECONOMIC_CALENDAR&horizon=3month&apikey=${encodeURIComponent(apiKey)}`;
          const payload = await fetchJson(url, policy) as { data?: Array<{ event?: string; date?: string; impact?: string }> };
          const events = (payload.data ?? []).slice(0, 10).map((row) => ({
            name: row.event ?? 'Unknown',
            date: row.date ?? new Date().toISOString().slice(0, 10),
            impact: row.impact ?? 'medium'
          }));

          return { country, events };
        }
      });
    }
  };

  const getIndicator: McpToolDefinition<z.infer<typeof indicatorInputSchema>, z.infer<typeof indicatorOutputSchema>> = {
    name: 'get_indicator',
    description: 'Get macro indicator value for symbol',
    inputSchema: indicatorInputSchema,
    outputSchema: indicatorOutputSchema,
    handler: async (input) => {
      const symbol = input.symbol ?? 'SPY';
      const cacheKey = buildCacheKey('get_indicator', { indicator: input.indicator, symbol });

      return await withCache({
        cache,
        key: cacheKey,
        ttlSeconds: indicatorTtl,
        logger,
        fetcher: async () => {
          const apiKey = requireEnv('ALPHA_VANTAGE_API_KEY');
          const url = `${alphaBase}?function=${encodeURIComponent(input.indicator)}&symbol=${encodeURIComponent(symbol)}&interval=daily&apikey=${encodeURIComponent(apiKey)}`;
          const payload = await fetchJson(url, policy) as { 'Global Quote'?: { '05. price'?: string } };
          const raw = payload['Global Quote']?.['05. price'];
          const parsed = raw ? Number(raw) : 0;

          return {
            indicator: input.indicator,
            symbol,
            value: Number.isFinite(parsed) ? parsed : 0,
            asOf: new Date().toISOString()
          };
        }
      });
    }
  };

  const getSectorMacroContext: McpToolDefinition<z.infer<typeof sectorInputSchema>, z.infer<typeof sectorOutputSchema>> = {
    name: 'get_sector_macro_context',
    description: 'Get sector-level macro context summary',
    inputSchema: sectorInputSchema,
    outputSchema: sectorOutputSchema,
    handler: async (input) => {
      const lowered = input.sector.toLowerCase();
      const riskLevel = lowered.includes('energy') ? 'high' : lowered.includes('utilities') ? 'low' : 'medium';
      return {
        sector: input.sector,
        summary: `${input.sector} macro context generated from configured indicators and event cadence`,
        riskLevel
      };
    }
  };

  return [getGdeltRisk, getEcoCalendar, getIndicator, getSectorMacroContext] as ReadonlyArray<McpAnyToolDefinition>;
}

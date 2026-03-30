import pino from 'pino';
import { z } from 'zod';

import type { McpConfig } from '../../../../../config/types/index.js';
import { buildCacheKey, createCache, withCache } from '../../shared/cache.js';
import { createConfigError, createUpstreamError, withRetry, withTimeout } from '../../shared/errors.js';
import type { McpAnyToolDefinition, McpToolDefinition } from '../../shared/tool-types.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info', name: 'news-mcp' });
const cache = createCache(process.env.REDIS_URL ? { redisUrl: process.env.REDIS_URL, logger } : { logger });

const tickerInputSchema = z.object({ ticker: z.string().min(1) }).strict();
const searchInputSchema = z.object({ query: z.string().min(1) }).strict();
const sectorInputSchema = z.object({ sector: z.string().min(1) }).strict();

const articleSchema = z.object({ headline: z.string(), source: z.string(), publishedAt: z.string(), sentiment: z.number() }).strict();
const tickerNewsOutputSchema = z.object({ ticker: z.string(), items: z.array(articleSchema) }).strict();
const searchNewsOutputSchema = z.object({ query: z.string(), items: z.array(articleSchema) }).strict();
const sentimentSummaryOutputSchema = z.object({ ticker: z.string(), score: z.number(), trend: z.enum(['positive', 'neutral', 'negative']) }).strict();
const topShiftOutputSchema = z.object({ items: z.array(z.object({ ticker: z.string(), shift: z.number() }).strict()) }).strict();
const sectorMoversOutputSchema = z.object({ sector: z.string(), movers: z.array(z.object({ ticker: z.string(), score: z.number() }).strict()) }).strict();

interface RetryPolicy {
  timeoutMs: number;
  maxAttempts: number;
  backoffMs: number;
}

interface FinnhubNewsRow {
  related?: string;
  headline?: string;
  source?: string;
  datetime?: number;
  sentiment?: number;
}

function getPolicy(config: McpConfig): RetryPolicy {
  const server = config.servers.news;
  const defaults = config.invoke?.defaultRetry;
  return {
    timeoutMs: server.timeoutMs,
    maxAttempts: server.retry?.maxAttempts ?? defaults?.maxAttempts ?? 1,
    backoffMs: server.retry?.backoffMs ?? defaults?.backoffMs ?? 0
  };
}

async function fetchJson(url: string, policy: RetryPolicy): Promise<unknown> {
  const execute = async (): Promise<unknown> => {
    const response = await withTimeout(async () => await fetch(url), policy.timeoutMs, 'News upstream timeout');
    if (!response.ok) {
      throw createUpstreamError(`News upstream failed (${response.status})`, { status: response.status, url });
    }

    return await response.json();
  };

  return await withRetry(execute, policy.maxAttempts, policy.backoffMs);
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw createConfigError(`Missing required environment variable: ${name}`);
  }

  return value;
}

function articleFromRow(row: FinnhubNewsRow): { headline: string; source: string; publishedAt: string; sentiment: number } {
  return {
    headline: typeof row.headline === 'string' ? row.headline : 'Untitled',
    source: typeof row.source === 'string' ? row.source : 'unknown',
    publishedAt: typeof row.datetime === 'number' ? new Date(row.datetime * 1000).toISOString() : new Date().toISOString(),
    sentiment: typeof row.sentiment === 'number' ? row.sentiment : 0
  };
}

function extractTicker(row: FinnhubNewsRow): string | null {
  if (!row.related || row.related.trim().length === 0) {
    return null;
  }

  const candidate = row.related.split(',')[0]?.trim().toUpperCase() ?? '';
  return candidate.length > 0 ? candidate : null;
}

function aggregateSentiment(rows: FinnhubNewsRow[]): Array<{ ticker: string; score: number }> {
  const byTicker = new Map<string, { sum: number; count: number }>();

  for (const row of rows) {
    const ticker = extractTicker(row);
    if (!ticker) {
      continue;
    }

    const sentiment = typeof row.sentiment === 'number' ? row.sentiment : 0;
    const current = byTicker.get(ticker) ?? { sum: 0, count: 0 };
    current.sum += sentiment;
    current.count += 1;
    byTicker.set(ticker, current);
  }

  return [...byTicker.entries()].map(([ticker, value]) => ({
    ticker,
    score: value.count === 0 ? 0 : value.sum / value.count
  }));
}

export function createNewsToolRegistry(config: McpConfig): ReadonlyArray<McpAnyToolDefinition> {
  const latestTtl = config.servers.news.cache?.latestTtlSec ?? 0;
  const sentimentTtl = config.servers.news.cache?.sentimentTtlSec ?? 0;
  const policy = getPolicy(config);
  const baseUrl = config.providers.newsBaseUrl;

  const getTickerNews: McpToolDefinition<z.infer<typeof tickerInputSchema>, z.infer<typeof tickerNewsOutputSchema>> = {
    name: 'get_ticker_news',
    description: 'Get latest ticker-specific news',
    inputSchema: tickerInputSchema,
    outputSchema: tickerNewsOutputSchema,
    handler: async (input) => {
      const key = buildCacheKey('get_ticker_news', input);
      return await withCache({
        cache,
        key,
        ttlSeconds: latestTtl,
        logger,
        fetcher: async () => {
          const token = requiredEnv('FINNHUB_API_KEY');
          const today = new Date().toISOString().slice(0, 10);
          const url = `${baseUrl}/company-news?symbol=${encodeURIComponent(input.ticker)}&from=${today}&to=${today}&token=${encodeURIComponent(token)}`;
          const payload = await fetchJson(url, policy) as FinnhubNewsRow[];
          return { ticker: input.ticker, items: payload.slice(0, 10).map(articleFromRow) };
        }
      });
    }
  };

  const searchNews: McpToolDefinition<z.infer<typeof searchInputSchema>, z.infer<typeof searchNewsOutputSchema>> = {
    name: 'search_news',
    description: 'Search broad market news',
    inputSchema: searchInputSchema,
    outputSchema: searchNewsOutputSchema,
    handler: async (input) => {
      const key = buildCacheKey('search_news', input);
      return await withCache({
        cache,
        key,
        ttlSeconds: latestTtl,
        logger,
        fetcher: async () => {
          const token = requiredEnv('FINNHUB_API_KEY');
          const url = `${baseUrl}/news?category=general&token=${encodeURIComponent(token)}`;
          const payload = await fetchJson(url, policy) as FinnhubNewsRow[];
          return { query: input.query, items: payload.slice(0, 20).map(articleFromRow) };
        }
      });
    }
  };

  const getSentimentSummary: McpToolDefinition<z.infer<typeof tickerInputSchema>, z.infer<typeof sentimentSummaryOutputSchema>> = {
    name: 'get_sentiment_summary',
    description: 'Get ticker sentiment summary',
    inputSchema: tickerInputSchema,
    outputSchema: sentimentSummaryOutputSchema,
    handler: async (input, context) => {
      const news = await getTickerNews.handler(input, context);
      const score = news.items.length === 0 ? 0 : news.items.reduce((sum, item) => sum + item.sentiment, 0) / news.items.length;
      return {
        ticker: input.ticker,
        score,
        trend: score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral'
      };
    }
  };

  const getTopSentimentShifts: McpToolDefinition<void, z.infer<typeof topShiftOutputSchema>> = {
    name: 'get_top_sentiment_shifts',
    description: 'Get top cross-ticker sentiment shifts',
    inputSchema: z.void(),
    outputSchema: topShiftOutputSchema,
    handler: async () => {
      const token = requiredEnv('FINNHUB_API_KEY');
      const url = `${baseUrl}/news?category=general&token=${encodeURIComponent(token)}`;
      const payload = await fetchJson(url, policy) as FinnhubNewsRow[];

      const items = aggregateSentiment(payload)
        .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
        .slice(0, 5)
        .map((entry) => ({ ticker: entry.ticker, shift: Number(entry.score.toFixed(4)) }));

      return { items };
    }
  };

  const getSectorMovers: McpToolDefinition<z.infer<typeof sectorInputSchema>, z.infer<typeof sectorMoversOutputSchema>> = {
    name: 'get_sector_movers',
    description: 'Get top movers by sentiment in a sector',
    inputSchema: sectorInputSchema,
    outputSchema: sectorMoversOutputSchema,
    handler: async (input) => {
      const key = buildCacheKey('get_sector_movers', input);
      return await withCache({
        cache,
        key,
        ttlSeconds: sentimentTtl,
        logger,
        fetcher: async () => {
          const token = requiredEnv('FINNHUB_API_KEY');
          const url = `${baseUrl}/news?category=general&token=${encodeURIComponent(token)}`;
          const payload = await fetchJson(url, policy) as FinnhubNewsRow[];

          const movers = aggregateSentiment(payload)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map((entry) => ({ ticker: entry.ticker, score: Number(entry.score.toFixed(4)) }));

          return { sector: input.sector, movers };
        }
      });
    }
  };

  return [getTickerNews, searchNews, getSentimentSummary, getTopSentimentShifts, getSectorMovers] as ReadonlyArray<McpAnyToolDefinition>;
}

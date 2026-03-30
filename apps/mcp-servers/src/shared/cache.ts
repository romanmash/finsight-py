import { Redis } from 'ioredis';

import type pino from 'pino';

export interface CacheBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export interface CacheOptions {
  redisUrl?: string | undefined;
  logger?: pino.Logger | undefined;
}

const globalInFlight = new Map<string, Promise<unknown>>();

class NoopCache implements CacheBackend {
  async get(_key: string): Promise<string | null> {
    return null;
  }

  async set(_key: string, _value: string, _ttlSeconds: number): Promise<void> {
    return;
  }
}

class InMemoryCache implements CacheBackend {
  private readonly store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

class RedisCache implements CacheBackend {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true
    });
  }

  async get(key: string): Promise<string | null> {
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }

    return await this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }

    await this.redis.set(key, value, 'EX', ttlSeconds);
  }
}

export function createCache(options: CacheOptions = {}): CacheBackend {
  if (!options.redisUrl) {
    return new NoopCache();
  }

  return new RedisCache(options.redisUrl);
}

export function createInMemoryCache(): CacheBackend {
  return new InMemoryCache();
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stableValue(source[key]);
        return acc;
      }, {});
  }

  return value;
}

export function buildCacheKey(toolName: string, input: unknown): string {
  const normalized = JSON.stringify(stableValue(input));
  return `${toolName}:${normalized}`;
}

export async function withCache<T>(params: {
  cache: CacheBackend;
  key: string;
  ttlSeconds: number;
  logger?: pino.Logger;
  fetcher: () => Promise<T>;
  inFlight?: Map<string, Promise<unknown>>;
}): Promise<T> {
  if (params.ttlSeconds <= 0) {
    return await params.fetcher();
  }

  try {
    const cached = await params.cache.get(params.key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch (error) {
    params.logger?.warn({ key: params.key, error }, 'Cache get failed, bypassing cache');
  }

  const inFlightByKey = params.inFlight ?? globalInFlight;
  const existing = inFlightByKey.get(params.key) as Promise<T> | undefined;
  if (existing) {
    return await existing;
  }

  const inFlight = (async (): Promise<T> => {
    const fresh = await params.fetcher();

    try {
      await params.cache.set(params.key, JSON.stringify(fresh), params.ttlSeconds);
    } catch (error) {
      params.logger?.warn({ key: params.key, error }, 'Cache set failed, bypassing cache');
    }

    return fresh;
  })();

  inFlightByKey.set(params.key, inFlight);

  try {
    return await inFlight;
  } finally {
    inFlightByKey.delete(params.key);
  }
}

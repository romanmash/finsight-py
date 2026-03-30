import { Redis } from 'ioredis';

import type { AgentName } from '@finsight/shared-types';

interface GlobalRedisCache {
  redis?: Redis;
}

function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (url === undefined || url.length === 0) {
    throw new Error('REDIS_URL is required');
  }

  return url;
}

const globalCache = globalThis as typeof globalThis & GlobalRedisCache;

export const redis: Redis =
  globalCache.redis ??
  new Redis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true
  });

if (process.env.NODE_ENV !== 'production') {
  globalCache.redis = redis;
}

export const RedisKey = {
  agentState(name: AgentName): string {
    return `agent:state:${name}`;
  },
  mcpCache(server: string, tool: string, hash: string): string {
    return `mcp:${server}:${tool}:${hash}`;
  }
} as const;

export interface BullMqConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
}

export function getBullMqConnectionOptions(): BullMqConnectionOptions {
  const parsed = new URL(getRedisUrl());
  const dbSegment = parsed.pathname.replace('/', '');
  const options: BullMqConnectionOptions = {
    host: parsed.hostname,
    port: Number.parseInt(parsed.port || '6379', 10)
  };

  if (parsed.username.length > 0) {
    options.username = parsed.username;
  }

  if (parsed.password.length > 0) {
    options.password = parsed.password;
  }

  if (dbSegment.length > 0) {
    options.db = Number.parseInt(dbSegment, 10);
  }

  return options;
}


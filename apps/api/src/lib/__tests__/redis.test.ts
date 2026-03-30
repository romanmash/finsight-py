import { beforeEach, describe, expect, it, vi } from 'vitest';

const pingMock = vi.fn<() => Promise<string>>().mockResolvedValue('PONG');
const redisConstructorMock = vi.fn();

class RedisMock {
  readonly ping = pingMock;

  constructor() {
    redisConstructorMock();
  }
}

vi.mock('ioredis', () => ({
  Redis: RedisMock,
  default: RedisMock
}));

interface RedisModule {
  redis: {
    ping: () => Promise<string>;
  };
  RedisKey: {
    agentState: (name: 'manager') => string;
    mcpCache: (server: string, tool: string, hash: string) => string;
  };
  getBullMqConnectionOptions: () => {
    host: string;
    port: number;
    username?: string;
    password?: string;
    db?: number;
  };
}

async function loadRedisModule(): Promise<RedisModule> {
  vi.resetModules();
  return import('../redis.js') as Promise<RedisModule>;
}

describe('redis singleton and key helpers', () => {
  beforeEach(() => {
    pingMock.mockClear();
    redisConstructorMock.mockClear();
    process.env.REDIS_URL = 'redis://localhost:6379/0';
    delete (globalThis as Record<string, unknown>).redis;
  });

  it('supports redis.ping() connectivity contract', async () => {
    const module = await loadRedisModule();

    await expect(module.redis.ping()).resolves.toBe('PONG');
    expect(pingMock).toHaveBeenCalledTimes(1);
  });

  it('formats agent state and mcp cache keys per contract', async () => {
    const module = await loadRedisModule();

    expect(module.RedisKey.agentState('manager')).toBe('agent:state:manager');
    expect(module.RedisKey.mcpCache('market-data', 'get_quote', 'abc123')).toBe('mcp:market-data:get_quote:abc123');
  });

  it('parses REDIS_URL into BullMQ connection options', async () => {
    process.env.REDIS_URL = 'redis://user:pass@redis-host:6380/2';
    const module = await loadRedisModule();

    expect(module.getBullMqConnectionOptions()).toEqual({
      host: 'redis-host',
      port: 6380,
      username: 'user',
      password: 'pass',
      db: 2
    });
  });
});

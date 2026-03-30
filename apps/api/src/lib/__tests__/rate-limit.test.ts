import { Hono } from 'hono';
import type { AppEnv } from '../../types/hono-context.js';
import { describe, expect, it, vi } from 'vitest';

import { rateLimitMiddleware } from '../../middleware/rate-limit.js';
import { toErrorResponse } from '../errors.js';

const mocks = vi.hoisted(() => ({
  redisIncrMock: vi.fn(),
  redisExpireMock: vi.fn()
}));

vi.mock('../redis.js', () => ({
  redis: {
    incr: mocks.redisIncrMock,
    expire: mocks.redisExpireMock
  }
}));

vi.mock('../config.js', () => ({
  getConfig: (): { telegram: { rateLimitPerUserPerMinute: number } } => ({
    telegram: {
      rateLimitPerUserPerMinute: 2
    }
  })
}));

describe('rate limit middleware', () => {
  it('returns 429 when threshold exceeded', async () => {
    mocks.redisIncrMock.mockResolvedValue(3);
    mocks.redisExpireMock.mockResolvedValue(1);

    const app = new Hono<AppEnv>();
    app.use('*', async (c, next): Promise<void> => {
      c.set('requestId', 'req-1');
      c.set('principal', null);
      await next();
    });
    app.use('*', rateLimitMiddleware());
    app.get('/limited', (c) => c.json({ ok: true }));
    app.onError((error, c) => toErrorResponse(c as never, error));

    const response = await app.request('/limited');
    expect(response.status).toBe(429);
  });

  it('fails open when redis errors', async () => {
    mocks.redisIncrMock.mockRejectedValue(new Error('redis down'));

    const app = new Hono<AppEnv>();
    app.use('*', async (c, next): Promise<void> => {
      c.set('requestId', 'req-2');
      c.set('principal', null);
      await next();
    });
    app.use('*', rateLimitMiddleware());
    app.get('/limited', (c) => c.json({ ok: true }));

    const response = await app.request('/limited');
    expect(response.status).toBe(200);
  });
});

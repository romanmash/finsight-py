import { Hono } from 'hono';
import type { AppEnv } from '../../types/hono-context.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toErrorResponse } from '../errors.js';

const userFindUniqueMock = vi.fn();
const ensureRedisStoreMock = vi.fn();
const refreshSessionMock = vi.fn();
const revokeRefreshSessionMock = vi.fn();

vi.mock('../../lib/db.js', () => ({
  db: {
    user: {
      findUnique: userFindUniqueMock
    }
  }
}));

vi.mock('../../lib/auth-tokens.js', () => ({
  issueAccessToken: vi.fn(),
  createRefreshSession: vi.fn(),
  ensureRedisSessionStoreAvailable: ensureRedisStoreMock,
  refreshSession: refreshSessionMock,
  revokeRefreshSession: revokeRefreshSessionMock
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn()
  }
}));

interface AuthRouterModule {
  createAuthRouter: () => Hono;
}

async function createSessionApp(withPrincipal = true): Promise<Hono<AppEnv>> {
  vi.resetModules();
  const module = (await import('../../routes/auth.js')) as unknown as AuthRouterModule;
  const app = new Hono<AppEnv>();
  if (withPrincipal) {
    app.use('/auth/me', async (c, next): Promise<void> => {
      c.set('principal', {
        userId: 'user-1',
        email: 'admin@example.com',
        name: 'Admin',
        role: 'admin',
        telegramHandle: null,
        active: true
      });
      await next();
    });
  }

  app.route('/auth', module.createAuthRouter());
  app.onError((error, c) => toErrorResponse(c as never, error));
  return app;
}

describe('auth session routes', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'x'.repeat(64);
    process.env.REFRESH_COOKIE_NAME = 'refreshToken';
    userFindUniqueMock.mockReset();
    ensureRedisStoreMock.mockReset();
    refreshSessionMock.mockReset();
    revokeRefreshSessionMock.mockReset();
    ensureRedisStoreMock.mockResolvedValue(undefined);
  });

  it('returns user profile from /auth/me for valid principal', async () => {
    userFindUniqueMock.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
      telegramHandle: null,
      active: true
    });

    const app = await createSessionApp();
    const response = await app.request('/auth/me');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: { id: string } };
    expect(body.user.id).toBe('user-1');
  });

  it('returns 401 from /auth/me when principal is missing', async () => {
    const app = await createSessionApp(false);
    const response = await app.request('/auth/me');

    expect(response.status).toBe(401);
  });

  it('returns new access token from /auth/refresh with cookie', async () => {
    refreshSessionMock.mockResolvedValue({
      accessToken: 'access-token-2',
      refreshSession: {
        refreshToken: 'refresh-token-2',
        expiresAt: new Date(Date.now() + 60000)
      }
    });

    const app = await createSessionApp();
    const response = await app.request('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: 'refreshToken=refresh-token-1'
      }
    });

    expect(response.status).toBe(200);
    expect((await response.json()) as { accessToken: string }).toEqual({ accessToken: 'access-token-2' });
    expect(ensureRedisStoreMock).toHaveBeenCalledTimes(1);
  });

  it('reads refresh cookie name from env at request time', async () => {
    refreshSessionMock.mockResolvedValue({
      accessToken: 'access-token-2',
      refreshSession: {
        refreshToken: 'refresh-token-2',
        expiresAt: new Date(Date.now() + 60000)
      }
    });

    const app = await createSessionApp();

    process.env.REFRESH_COOKIE_NAME = 'r1';
    const first = await app.request('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: 'r1=refresh-token-1'
      }
    });

    process.env.REFRESH_COOKIE_NAME = 'r2';
    const second = await app.request('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: 'r2=refresh-token-1'
      }
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(refreshSessionMock).toHaveBeenCalledTimes(2);
  });

  it('maps redis refresh errors to 503', async () => {
    refreshSessionMock.mockRejectedValue(new Error('Redis ECONNREFUSED while refreshing token'));

    const app = await createSessionApp();
    const response = await app.request('/auth/refresh', {
      method: 'POST',
      headers: {
        cookie: 'refreshToken=refresh-token-1'
      }
    });

    expect(response.status).toBe(503);
  });

  it('returns 204 and clears cookie from /auth/logout', async () => {
    revokeRefreshSessionMock.mockResolvedValue(undefined);

    const app = await createSessionApp();
    const response = await app.request('/auth/logout', {
      method: 'POST',
      headers: {
        cookie: 'refreshToken=refresh-token-1'
      }
    });

    expect(response.status).toBe(204);
    expect(revokeRefreshSessionMock).toHaveBeenCalledTimes(1);
  });

  it('maps redis logout errors to 503', async () => {
    revokeRefreshSessionMock.mockRejectedValue(new Error('redis timeout on delete'));

    const app = await createSessionApp();
    const response = await app.request('/auth/logout', {
      method: 'POST',
      headers: {
        cookie: 'refreshToken=refresh-token-1'
      }
    });

    expect(response.status).toBe(503);
  });
});

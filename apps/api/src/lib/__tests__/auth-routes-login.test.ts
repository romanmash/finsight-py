import { Hono } from 'hono';
import type { AppEnv } from '../../types/hono-context.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toErrorResponse } from '../errors.js';

const userFindUniqueMock = vi.fn();
const issueAccessTokenMock = vi.fn();
const createRefreshSessionMock = vi.fn();

vi.mock('../../lib/db.js', () => ({
  db: {
    user: {
      findUnique: userFindUniqueMock
    }
  }
}));

vi.mock('../../lib/auth-tokens.js', () => ({
  issueAccessToken: issueAccessTokenMock,
  createRefreshSession: createRefreshSessionMock,
  ensureRedisSessionStoreAvailable: vi.fn(),
  refreshSession: vi.fn(),
  revokeRefreshSession: vi.fn()
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn()
  }
}));

interface AuthRouterModule {
  createAuthRouter: () => Hono;
}

async function createTestApp(): Promise<Hono<AppEnv>> {
  vi.resetModules();
  const module = (await import('../../routes/auth.js')) as unknown as AuthRouterModule;
  const app = new Hono<AppEnv>();
  app.route('/auth', module.createAuthRouter());
  app.onError((error, c) => toErrorResponse(c as never, error));
  return app;
}

describe('auth login routes', () => {
  beforeEach(() => {
    userFindUniqueMock.mockReset();
    issueAccessTokenMock.mockReset();
    createRefreshSessionMock.mockReset();
    process.env.JWT_SECRET = 'x'.repeat(64);
  });

  it('returns access token and refresh cookie for valid credentials', async () => {
    const bcrypt = (await import('bcryptjs')).default;
    vi.mocked(bcrypt.compare).mockResolvedValue(true);

    userFindUniqueMock.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
      telegramHandle: '@admin',
      active: true,
      passwordHash: 'hash'
    });
    issueAccessTokenMock.mockResolvedValue('access-token-1');
    createRefreshSessionMock.mockResolvedValue({
      refreshToken: 'refresh-token-1',
      expiresAt: new Date(Date.now() + 60000)
    });

    const app = await createTestApp();
    const response = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'secret123' })
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { accessToken: string; user: { email: string } };
    expect(body.accessToken).toBe('access-token-1');
    expect(body.user.email).toBe('admin@example.com');
    expect(response.headers.get('set-cookie')).toContain('refreshToken=');
  });

  it('returns 401 for invalid credentials', async () => {
    const bcrypt = (await import('bcryptjs')).default;
    vi.mocked(bcrypt.compare).mockResolvedValue(false);

    userFindUniqueMock.mockResolvedValue({
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
      telegramHandle: null,
      active: true,
      passwordHash: 'hash'
    });

    const app = await createTestApp();
    const response = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'bad' })
    });

    expect(response.status).toBe(401);
  });
});






import { Hono } from 'hono';
import type { AppEnv } from '../../types/hono-context.js';
import { describe, expect, it, vi } from 'vitest';

import { authMiddleware } from '../../middleware/auth.js';
import { roleGuard } from '../../middleware/role-guard.js';
import { toErrorResponse } from '../errors.js';

const mocks = vi.hoisted(() => ({
  verifyAccessTokenMock: vi.fn(),
  userFindUniqueMock: vi.fn()
}));

vi.mock('../auth-tokens.js', () => ({
  verifyAccessToken: mocks.verifyAccessTokenMock
}));

vi.mock('../db.js', () => ({
  db: {
    user: {
      findUnique: mocks.userFindUniqueMock
    }
  }
}));

describe('auth + role middleware', () => {
  it('returns 401 when bearer token is missing', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', authMiddleware());
    app.get('/secure', (c) => c.json({ ok: true }));
    app.onError((error, c) => toErrorResponse(c as never, error));

    const response = await app.request('/secure');
    expect(response.status).toBe(401);
  });

  it('returns 403 when role does not match', async () => {
    mocks.verifyAccessTokenMock.mockResolvedValue({
      userId: 'user-1',
      email: 'user@example.com',
      name: 'User',
      role: 'analyst',
      telegramHandle: null,
      active: true
    });
    mocks.userFindUniqueMock.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      role: 'analyst',
      telegramHandle: null,
      active: true
    });

    const app = new Hono<AppEnv>();
    app.use('*', authMiddleware());
    app.use('*', roleGuard('admin'));
    app.get('/admin', (c) => c.json({ ok: true }));
    app.onError((error, c) => toErrorResponse(c as never, error));

    const response = await app.request('/admin', {
      headers: { authorization: 'Bearer token-1' }
    });

    expect(response.status).toBe(403);
  });
});

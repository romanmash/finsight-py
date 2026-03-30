import { beforeEach, describe, expect, it, vi } from 'vitest';

const refreshTokenCreateMock = vi.fn();
const refreshTokenFindUniqueMock = vi.fn();
const refreshTokenDeleteMock = vi.fn();
const refreshTokenDeleteManyMock = vi.fn();
const userFindUniqueMock = vi.fn();

const redisPingMock = vi.fn();
const redisSetMock = vi.fn();
const redisGetMock = vi.fn();
const redisDelMock = vi.fn();

vi.mock('../db.js', () => ({
  db: {
    refreshToken: {
      create: refreshTokenCreateMock,
      findUnique: refreshTokenFindUniqueMock,
      delete: refreshTokenDeleteMock,
      deleteMany: refreshTokenDeleteManyMock
    },
    user: {
      findUnique: userFindUniqueMock
    }
  }
}));

vi.mock('../redis.js', () => ({
  redis: {
    ping: redisPingMock,
    set: redisSetMock,
    get: redisGetMock,
    del: redisDelMock
  }
}));

vi.mock('../config.js', () => ({
  getConfig: (): { auth: { accessTokenExpiryMinutes: number; refreshTokenExpiryDays: number; bcryptRounds: number } } => ({
    auth: {
      accessTokenExpiryMinutes: 15,
      refreshTokenExpiryDays: 7,
      bcryptRounds: 12
    }
  })
}));

interface AuthTokensModule {
  issueAccessToken: (payload: {
    sub: string;
    role: 'admin' | 'analyst' | 'viewer';
    email: string;
    name: string;
    telegramHandle: string | null;
  }) => Promise<string>;
  verifyAccessToken: (token: string) => Promise<{ userId: string; role: string }>;
  createRefreshSession: (userId: string) => Promise<{ refreshToken: string; expiresAt: Date }>;
  refreshSession: (refreshToken: string) => Promise<{ accessToken: string; refreshSession: { refreshToken: string } }>;
  revokeRefreshSession: (refreshToken: string) => Promise<void>;
  ensureRedisSessionStoreAvailable: () => Promise<void>;
  getAccessTokenExpirySecondsForTests: () => number;
  getRefreshTokenExpirySecondsForTests: () => number;
}

async function loadModule(): Promise<AuthTokensModule> {
  vi.resetModules();
  return import('../auth-tokens.js') as Promise<AuthTokensModule>;
}

describe('auth token utilities', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'x'.repeat(64);

    refreshTokenCreateMock.mockReset();
    refreshTokenFindUniqueMock.mockReset();
    refreshTokenDeleteMock.mockReset();
    refreshTokenDeleteManyMock.mockReset();
    userFindUniqueMock.mockReset();

    redisPingMock.mockReset();
    redisSetMock.mockReset();
    redisGetMock.mockReset();
    redisDelMock.mockReset();

    redisPingMock.mockResolvedValue('PONG');
    redisSetMock.mockResolvedValue('OK');
    redisGetMock.mockResolvedValue('session-id');
    redisDelMock.mockResolvedValue(1);
  });

  it('uses runtime-configured token windows', async () => {
    const module = await loadModule();

    expect(module.getAccessTokenExpirySecondsForTests()).toBe(15 * 60);
    expect(module.getRefreshTokenExpirySecondsForTests()).toBe(7 * 86400);
  });

  it('issues and verifies an access token', async () => {
    const module = await loadModule();

    const token = await module.issueAccessToken({
      sub: 'user-1',
      role: 'admin',
      email: 'admin@example.com',
      name: 'Admin',
      telegramHandle: null
    });

    const verified = await module.verifyAccessToken(token);
    expect(verified.userId).toBe('user-1');
    expect(verified.role).toBe('admin');
  });

  it('creates refresh session and stores redis state', async () => {
    refreshTokenCreateMock.mockResolvedValue({ id: 'session-1' });

    const module = await loadModule();
    const session = await module.createRefreshSession('user-1');

    expect(session.refreshToken.length).toBeGreaterThan(0);
    expect(session.expiresAt).toBeInstanceOf(Date);
    expect(refreshTokenCreateMock).toHaveBeenCalledTimes(1);
    expect(redisSetMock).toHaveBeenCalledTimes(1);
  });

  it('rotates refresh session and returns new access token', async () => {
    refreshTokenFindUniqueMock.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60000)
    });
    refreshTokenDeleteMock.mockResolvedValue({});
    refreshTokenCreateMock.mockResolvedValue({ id: 'session-2' });
    userFindUniqueMock.mockResolvedValue({
      id: 'user-1',
      role: 'admin',
      email: 'admin@example.com',
      name: 'Admin',
      telegramHandle: null,
      active: true
    });

    const module = await loadModule();
    const result = await module.refreshSession('raw-token');

    expect(result.accessToken.length).toBeGreaterThan(0);
    expect(result.refreshSession.refreshToken.length).toBeGreaterThan(0);
    expect(refreshTokenDeleteMock).toHaveBeenCalledTimes(1);
  });

  it('revokes refresh token session', async () => {
    refreshTokenDeleteManyMock.mockResolvedValue({ count: 1 });

    const module = await loadModule();
    await module.revokeRefreshSession('raw-token');

    expect(refreshTokenDeleteManyMock).toHaveBeenCalledTimes(1);
    expect(redisDelMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed when redis session store is unavailable', async () => {
    redisPingMock.mockRejectedValue(new Error('redis down'));

    const module = await loadModule();
    await expect(module.ensureRedisSessionStoreAvailable()).rejects.toThrow('Redis session store unavailable');
  });
});




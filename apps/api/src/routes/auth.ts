import bcrypt from 'bcryptjs';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';

import {
  createRefreshSession,
  ensureRedisSessionStoreAvailable,
  issueAccessToken,
  refreshSession,
  revokeRefreshSession
} from '../lib/auth-tokens.js';
import { db } from '../lib/db.js';
import { serviceUnavailable, unauthorized } from '../lib/errors.js';
import type { AppEnv, AuthenticatedPrincipal } from '../types/hono-context.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
}).strict();

interface ApiUserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  telegramHandle: string | null;
  active: boolean;
}

function toUserProfile(user: { id: string; email: string; name: string; role: string; telegramHandle: string | null; active: boolean }): ApiUserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    telegramHandle: user.telegramHandle,
    active: user.active
  };
}

function getRefreshCookieName(): string {
  return process.env.REFRESH_COOKIE_NAME ?? 'refreshToken';
}

function setRefreshCookie(c: Parameters<typeof setCookie>[0], refreshToken: string, expiresAt: Date): void {
  setCookie(c, getRefreshCookieName(), refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    path: '/',
    expires: expiresAt
  });
}

function clearRefreshCookie(c: Parameters<typeof deleteCookie>[0]): void {
  deleteCookie(c, getRefreshCookieName(), {
    path: '/'
  });
}

function isRedisError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('redis') || message.includes('econnrefused');
}

function getPrincipalOrThrow(c: Context<AppEnv>): AuthenticatedPrincipal {
  const principal = c.get('principal');
  if (principal === null || principal === undefined) {
    throw unauthorized('Missing authenticated principal');
  }

  return principal;
}

export function createAuthRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post('/login', async (c) => {
    const parsed = loginSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      throw unauthorized('Invalid login payload');
    }

    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        telegramHandle: true,
        active: true,
        passwordHash: true
      }
    });

    if (user === null || !user.active) {
      throw unauthorized('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw unauthorized('Invalid credentials');
    }

    const [accessToken, refresh] = await Promise.all([
      issueAccessToken({
        sub: user.id,
        role: user.role as 'admin' | 'analyst' | 'viewer',
        email: user.email,
        name: user.name,
        telegramHandle: user.telegramHandle
      }),
      createRefreshSession(user.id)
    ]);

    setRefreshCookie(c, refresh.refreshToken, refresh.expiresAt);

    return c.json({
      accessToken,
      user: toUserProfile(user)
    });
  });

  router.post('/refresh', async (c) => {
    await ensureRedisSessionStoreAvailable();

    const refreshToken = getCookie(c, getRefreshCookieName());
    if (refreshToken === undefined || refreshToken.length === 0) {
      throw unauthorized('Missing refresh token cookie');
    }

    let refreshed: Awaited<ReturnType<typeof refreshSession>>;
    try {
      refreshed = await refreshSession(refreshToken);
    } catch (error) {
      if (isRedisError(error)) {
        throw serviceUnavailable('Redis session store unavailable');
      }

      throw error;
    }

    setRefreshCookie(c, refreshed.refreshSession.refreshToken, refreshed.refreshSession.expiresAt);

    return c.json({
      accessToken: refreshed.accessToken
    });
  });

  router.post('/logout', async (c) => {
    await ensureRedisSessionStoreAvailable();

    const refreshToken = getCookie(c, getRefreshCookieName());
    if (refreshToken === undefined || refreshToken.length === 0) {
      throw unauthorized('Missing refresh token cookie');
    }

    try {
      await revokeRefreshSession(refreshToken);
    } catch (error) {
      if (isRedisError(error)) {
        throw serviceUnavailable('Redis session store unavailable');
      }

      throw error;
    }

    clearRefreshCookie(c);

    return c.body(null, 204);
  });

  router.get('/me', async (c) => {
    const principal = getPrincipalOrThrow(c);

    const user = await db.user.findUnique({
      where: { id: principal.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        telegramHandle: true,
        active: true
      }
    });

    if (user === null || !user.active) {
      throw unauthorized('User is inactive or missing');
    }

    return c.json({ user: toUserProfile(user) });
  });

  return router;
}

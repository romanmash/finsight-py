import type { MiddlewareHandler } from 'hono';

import { db } from '../lib/db.js';
import { unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/auth-tokens.js';
import type { AppEnv } from '../types/hono-context.js';

const BEARER_PREFIX = 'Bearer ';

export function authMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next): Promise<void> => {
    const authorization = c.req.header('authorization');
    if (authorization === undefined || !authorization.startsWith(BEARER_PREFIX)) {
      throw unauthorized('Missing bearer token');
    }

    const accessToken = authorization.slice(BEARER_PREFIX.length).trim();
    const principal = await verifyAccessToken(accessToken);

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

    c.set('principal', {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'admin' | 'analyst' | 'viewer',
      telegramHandle: user.telegramHandle,
      active: user.active
    });

    await next();
  };
}

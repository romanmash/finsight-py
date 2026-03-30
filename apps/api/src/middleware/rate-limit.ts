import type { MiddlewareHandler } from 'hono';

import { getConfig } from '../lib/config.js';
import { ApiError, tooManyRequests } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { redis } from '../lib/redis.js';
import type { AppEnv } from '../types/hono-context.js';

const SECONDS_PER_MINUTE = 60;

interface RateLimitSettings {
  windowSeconds: number;
  maxRequests: number;
}

function getRateLimitSettings(): RateLimitSettings {
  const maxRequests = getConfig().telegram.rateLimitPerUserPerMinute;
  return {
    windowSeconds: SECONDS_PER_MINUTE,
    maxRequests
  };
}

function resolveRateLimitKey(c: Parameters<MiddlewareHandler<AppEnv>>[0]): string {
  const principal = c.get('principal');
  if (principal !== null) {
    return `rate-limit:user:${principal.userId}`;
  }

  const forwarded = c.req.header('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() ?? c.req.header('x-real-ip') ?? 'anonymous';
  return `rate-limit:ip:${ip}`;
}

export function rateLimitMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next): Promise<void> => {
    const settings = getRateLimitSettings();
    const key = resolveRateLimitKey(c);

    try {
      const currentCount = await redis.incr(key);
      if (currentCount === 1) {
        await redis.expire(key, settings.windowSeconds);
      }

      if (currentCount > settings.maxRequests) {
        throw tooManyRequests('Rate limit exceeded');
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      logger.warn(
        {
          requestId: c.get('requestId'),
          error: error instanceof Error ? error.message : 'unknown'
        },
        'Rate limiter failed open due to Redis error'
      );
    }

    await next();
  };
}

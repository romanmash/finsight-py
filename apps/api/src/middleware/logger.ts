import type { MiddlewareHandler } from 'hono';

import { logger } from '../lib/logger.js';
import type { AppEnv } from '../types/hono-context.js';

interface RequestLogRecord {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}

export function loggerMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next): Promise<void> => {
    await next();

    const record: RequestLogRecord = {
      requestId: c.get('requestId') ?? 'unknown',
      method: c.req.method,
      path: c.req.path,
      statusCode: c.res.status,
      durationMs: Date.now() - c.get('requestStartMs')
    };

    logger.info(record);
  };
}

import type { MiddlewareHandler } from 'hono';

import type { AppEnv } from '../types/hono-context.js';

function createRequestId(): string {
  return crypto.randomUUID();
}

export function requestIdMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next): Promise<void> => {
    const requestId = c.req.header('x-request-id') ?? createRequestId();
    c.set('requestId', requestId);
    c.set('requestStartMs', Date.now());

    await next();

    c.header('x-request-id', requestId);
  };
}

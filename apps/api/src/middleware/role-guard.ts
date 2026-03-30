import type { MiddlewareHandler } from 'hono';

import { forbidden, unauthorized } from '../lib/errors.js';
import type { AppEnv, UserRole } from '../types/hono-context.js';

export function roleGuard(requiredRole: UserRole): MiddlewareHandler<AppEnv> {
  return async (c, next): Promise<void> => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized('Missing authenticated principal');
    }

    if (principal.role !== requiredRole) {
      throw forbidden('Insufficient role privileges');
    }

    await next();
  };
}

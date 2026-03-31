import { Hono } from 'hono';

import { authMiddleware } from './middleware/auth.js';
import { loggerMiddleware } from './middleware/logger.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { roleGuard } from './middleware/role-guard.js';
import { toErrorResponse } from './lib/errors.js';
import { createAdminRouter, adminStatusHandler } from './routes/admin.js';
import { createAuthRouter } from './routes/auth.js';
import { createBriefsRouter } from './routes/briefs.js';
import { createScreenerRouter } from './routes/screener.js';
import { createWatchdogRouter } from './routes/watchdog.js';
import type { AppEnv } from './types/hono-context.js';

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', requestIdMiddleware());
  app.use('*', async (c, next): Promise<void> => {
    c.set('principal', null);
    await next();
  });
  app.use('*', loggerMiddleware());
  app.use('*', rateLimitMiddleware());

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.use('/auth/me', authMiddleware());

  app.use('/admin/*', authMiddleware());
  app.use('/admin/*', roleGuard('admin'));

  app.use('/api/admin/*', authMiddleware());
  app.use('/api/admin/*', roleGuard('admin'));

  app.use('/api/watchdog/*', authMiddleware());
  app.use('/api/watchdog/*', roleGuard('admin'));

  app.use('/api/screener/*', authMiddleware());
  app.use('/api/screener/*', roleGuard('admin'));

  app.use('/api/briefs/*', authMiddleware());

  app.route('/auth', createAuthRouter());
  app.route('/admin', createAdminRouter());
  app.route('/api/watchdog', createWatchdogRouter());
  app.route('/api/screener', createScreenerRouter());
  app.route('/api/briefs', createBriefsRouter());
  app.get('/api/admin/status', adminStatusHandler);

  app.onError((error, c) => toErrorResponse(c, error));

  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Not Found', requestId: c.get('requestId') } }, 404));

  return app;
}

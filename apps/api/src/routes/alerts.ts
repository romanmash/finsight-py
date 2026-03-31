import { Hono } from 'hono';

import { db } from '../lib/db.js';
import { unauthorized } from '../lib/errors.js';
import type { AppEnv } from '../types/hono-context.js';

export function createAlertsRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized();
    }

    const where = principal.role === 'admin'
      ? { acknowledged: false }
      : { userId: principal.userId, acknowledged: false };

    const alerts = await db.alert.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return c.json({
      alerts: alerts.map((alert) => ({
        id: alert.id,
        userId: alert.userId,
        ticker: alert.ticker,
        alertType: alert.alertType,
        severity: alert.severity,
        message: alert.message,
        acknowledged: alert.acknowledged,
        createdAt: alert.createdAt.toISOString()
      }))
    });
  });

  router.post('/:id/ack', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized();
    }

    const id = c.req.param('id');
    const result = await db.alert.updateMany({
      where: {
        id,
        ...(principal.role === 'admin' ? {} : { userId: principal.userId })
      },
      data: { acknowledged: true }
    });

    return c.json({ acknowledged: result.count > 0 });
  });

  return router;
}

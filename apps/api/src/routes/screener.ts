import { Hono } from 'hono';

import { db } from '../lib/db.js';
import { screenerScanQueue } from '../lib/queues.js';
import { unauthorized } from '../lib/errors.js';
import type { AppEnv } from '../types/hono-context.js';

export function createScreenerRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post('/trigger', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized();
    }

    await screenerScanQueue.add('manual-screener-trigger', { triggeredBy: 'manual' });
    return c.json({ queued: true, queue: 'screenerScan' }, 202);
  });

  router.get('/summary', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized();
    }

    const run = await db.screenerRun.findFirst({ orderBy: { createdAt: 'desc' } });
    if (run === null) {
      return c.json({ summary: null });
    }

    return c.json({
      summary: {
        id: run.id,
        triggeredBy: run.triggeredBy,
        results: run.results,
        createdAt: run.createdAt.toISOString()
      }
    });
  });

  return router;
}

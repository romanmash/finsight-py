import { Hono } from 'hono';

import { screenerScanQueue } from '../lib/queues.js';
import type { AppEnv } from '../types/hono-context.js';

export function createScreenerRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post('/trigger', async (c) => {
    await screenerScanQueue.add('manual-screener-trigger', { triggeredBy: 'admin-api' });
    return c.json({ queued: true, queue: 'screenerScan' }, 202);
  });

  return router;
}

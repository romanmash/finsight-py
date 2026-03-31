import { Hono } from 'hono';

import { watchdogScanQueue } from '../lib/queues.js';
import type { AppEnv } from '../types/hono-context.js';

export function createWatchdogRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post('/trigger', async (c) => {
    await watchdogScanQueue.add('manual-watchdog-trigger', { triggeredBy: 'manual' });
    return c.json({ queued: true, queue: 'watchdogScan' }, 202);
  });

  return router;
}

import { Worker } from 'bullmq';

import { runScreener } from '../agents/screener.js';
import { getConfig } from '../lib/config.js';
import { getBullMqConnectionOptions } from '../lib/redis.js';
import { buildWorkerOptions } from '../scheduler/init-scheduler.js';

export function createScreenerWorker(): Worker<Record<string, unknown>> {
  const scheduler = getConfig().scheduler;

  return new Worker<Record<string, unknown>>(
    'screenerScan',
    async (job): Promise<void> => {
      await runScreener({ triggeredBy: job.name.startsWith('manual') ? 'manual' : 'scheduled' });
    },
    {
      connection: getBullMqConnectionOptions(),
      ...buildWorkerOptions(scheduler.screenerScan.concurrency)
    }
  );
}
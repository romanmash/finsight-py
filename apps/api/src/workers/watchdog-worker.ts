import { Worker } from 'bullmq';

import { runWatchdog } from '../agents/watchdog.js';
import { getConfig } from '../lib/config.js';
import { getBullMqConnectionOptions } from '../lib/redis.js';
import { buildWorkerOptions } from '../scheduler/init-scheduler.js';

export function createWatchdogWorker(): Worker<Record<string, unknown>> {
  const scheduler = getConfig().scheduler;

  return new Worker<Record<string, unknown>>(
    'watchdogScan',
    async (job): Promise<void> => {
      await runWatchdog({ triggeredBy: job.name.startsWith('manual') ? 'manual' : 'scheduled' });
    },
    {
      connection: getBullMqConnectionOptions(),
      ...buildWorkerOptions(scheduler.watchdogScan.concurrency)
    }
  );
}
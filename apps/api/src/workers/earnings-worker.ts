import { Worker } from 'bullmq';

import { getConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { getBullMqConnectionOptions } from '../lib/redis.js';
import { buildWorkerOptions } from '../scheduler/init-scheduler.js';

async function runEarningsCheckCycle(): Promise<void> {
  logger.info('Earnings check worker cycle executed');
}

export function createEarningsWorker(): Worker<Record<string, unknown>> {
  const scheduler = getConfig().scheduler;

  return new Worker<Record<string, unknown>>(
    'earningsCheck',
    async (): Promise<void> => {
      await runEarningsCheckCycle();
    },
    {
      connection: getBullMqConnectionOptions(),
      ...buildWorkerOptions(scheduler.earningsCheck.concurrency)
    }
  );
}
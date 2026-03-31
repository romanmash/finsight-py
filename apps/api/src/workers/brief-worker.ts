import { Worker } from 'bullmq';

import { getConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { getBullMqConnectionOptions } from '../lib/redis.js';
import { buildWorkerOptions } from '../scheduler/init-scheduler.js';

async function runDailyBriefCycle(): Promise<void> {
  logger.info('Daily brief worker cycle executed');
}

export function createBriefWorker(): Worker<Record<string, unknown>> {
  const scheduler = getConfig().scheduler;

  return new Worker<Record<string, unknown>>(
    'dailyBrief',
    async (): Promise<void> => {
      await runDailyBriefCycle();
    },
    {
      connection: getBullMqConnectionOptions(),
      ...buildWorkerOptions(scheduler.dailyBrief.concurrency)
    }
  );
}
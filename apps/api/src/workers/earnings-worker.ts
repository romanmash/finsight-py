import { Worker } from 'bullmq';

import { runManager } from '../agents/manager.js';
import { db } from '../lib/db.js';
import { getConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { getBullMqConnectionOptions } from '../lib/redis.js';
import { buildWorkerOptions } from '../scheduler/init-scheduler.js';

async function runEarningsCheckCycle(): Promise<void> {
  const watchlist = await db.watchlistItem.findMany({ where: { active: true }, select: { ticker: true, userId: true } });

  for (const item of watchlist) {
    await runManager({
      userId: item.userId,
      missionType: 'earnings_prebrief',
      triggerType: 'scheduled',
      ticker: item.ticker,
      message: `Earnings prebrief for ${item.ticker}`
    });
  }

  logger.info({ watchlistCount: watchlist.length }, 'Earnings check worker cycle executed');
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

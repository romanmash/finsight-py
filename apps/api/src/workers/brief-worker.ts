import { Worker } from 'bullmq';

import { runManager } from '../agents/manager.js';
import { db } from '../lib/db.js';
import { getConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { getBullMqConnectionOptions } from '../lib/redis.js';
import { buildWorkerOptions } from '../scheduler/init-scheduler.js';

async function runDailyBriefCycle(): Promise<void> {
  const users = await db.user.findMany({ where: { active: true }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) {
    logger.info({ users: 0 }, 'Daily brief worker cycle executed');
    return;
  }

  const watchlist = await db.watchlistItem.findMany({
    where: {
      active: true,
      userId: { in: userIds }
    },
    select: {
      userId: true,
      ticker: true
    }
  });

  const tickersByUser = new Map<string, Set<string>>();
  for (const item of watchlist) {
    const existing = tickersByUser.get(item.userId) ?? new Set<string>();
    existing.add(item.ticker.toUpperCase());
    tickersByUser.set(item.userId, existing);
  }

  let dispatched = 0;
  for (const user of users) {
    const tickers = Array.from(tickersByUser.get(user.id) ?? []);
    if (tickers.length === 0) {
      continue;
    }

    await runManager({
      userId: user.id,
      missionType: 'daily_brief',
      triggerType: 'scheduled',
      message: 'Daily brief generation',
      tickers
    });

    dispatched += 1;
  }

  logger.info({ users: users.length, dispatched }, 'Daily brief worker cycle executed');
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

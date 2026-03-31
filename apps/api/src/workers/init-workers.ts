import type { Worker } from 'bullmq';

import { logger } from '../lib/logger.js';
import { createBriefWorker } from './brief-worker.js';
import { createEarningsWorker } from './earnings-worker.js';
import { createScreenerWorker } from './screener-worker.js';
import { createTicketExpiryWorker } from './ticket-expiry-worker.js';
import { createWatchdogWorker } from './watchdog-worker.js';

export interface CollectorWorkers {
  watchdog: Worker<Record<string, unknown>>;
  screener: Worker<Record<string, unknown>>;
  dailyBrief: Worker<Record<string, unknown>>;
  earningsCheck: Worker<Record<string, unknown>>;
  ticketExpiry: Worker<Record<string, unknown>>;
}

export function initCollectorWorkers(): CollectorWorkers {
  const workers: CollectorWorkers = {
    watchdog: createWatchdogWorker(),
    screener: createScreenerWorker(),
    dailyBrief: createBriefWorker(),
    earningsCheck: createEarningsWorker(),
    ticketExpiry: createTicketExpiryWorker()
  };

  logger.info(
    {
      queues: ['watchdogScan', 'screenerScan', 'dailyBrief', 'earningsCheck', 'ticketExpiry']
    },
    'Collector workers initialized'
  );

  return workers;
}

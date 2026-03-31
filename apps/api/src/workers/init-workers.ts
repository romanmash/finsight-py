import { logger } from '../lib/logger.js';
import { createAlertPipelineWorker } from './alert-pipeline-worker.js';
import { createBriefWorker } from './brief-worker.js';
import { createEarningsWorker } from './earnings-worker.js';
import { createScreenerWorker } from './screener-worker.js';
import { createTicketExpiryWorker } from './ticket-expiry-worker.js';
import { createWatchdogWorker } from './watchdog-worker.js';

export interface CollectorWorkers {
  watchdog: ReturnType<typeof createWatchdogWorker>;
  screener: ReturnType<typeof createScreenerWorker>;
  alertPipeline: ReturnType<typeof createAlertPipelineWorker>;
  dailyBrief: ReturnType<typeof createBriefWorker>;
  earningsCheck: ReturnType<typeof createEarningsWorker>;
  ticketExpiry: ReturnType<typeof createTicketExpiryWorker>;
}

export function initCollectorWorkers(): CollectorWorkers {
  const workers: CollectorWorkers = {
    watchdog: createWatchdogWorker(),
    screener: createScreenerWorker(),
    alertPipeline: createAlertPipelineWorker(),
    dailyBrief: createBriefWorker(),
    earningsCheck: createEarningsWorker(),
    ticketExpiry: createTicketExpiryWorker()
  };

  logger.info(
    {
      queues: ['watchdogScan', 'screenerScan', 'alertPipeline', 'dailyBrief', 'earningsCheck', 'ticketExpiry']
    },
    'Collector workers initialized'
  );

  return workers;
}

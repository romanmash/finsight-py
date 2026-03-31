import { Queue } from 'bullmq';

import { getConfig } from './config.js';
import { getBullMqConnectionOptions } from './redis.js';

const connection = getBullMqConnectionOptions();
const DEFAULT_QUEUE_ATTEMPTS = 1;
const DEFAULT_QUEUE_BACKOFF_MS = 1000;

function resolveSchedulerRetryConfig(jobName: keyof ReturnType<typeof getConfig>['scheduler']): {
  attempts: number;
  backoffMs: number;
} {
  try {
    const schedulerConfig = getConfig().scheduler[jobName];
    return {
      // BullMQ attempts is total tries (1 initial attempt + configured retries).
      attempts: schedulerConfig.retryAttempts + 1,
      backoffMs: schedulerConfig.retryBackoffMs
    };
  } catch {
    return {
      attempts: DEFAULT_QUEUE_ATTEMPTS,
      backoffMs: DEFAULT_QUEUE_BACKOFF_MS
    };
  }
}

function queueOptions(jobName: keyof ReturnType<typeof getConfig>['scheduler']): {
  connection: ReturnType<typeof getBullMqConnectionOptions>;
  defaultJobOptions: {
    attempts: number;
    backoff: { type: 'fixed'; delay: number };
    removeOnComplete: number;
  };
} {
  const retryConfig = resolveSchedulerRetryConfig(jobName);

  return {
    connection,
    defaultJobOptions: {
      attempts: retryConfig.attempts,
      backoff: {
        type: 'fixed',
        delay: retryConfig.backoffMs
      },
      removeOnComplete: 100
    }
  };
}

export const watchdogScanQueue = new Queue('watchdogScan', queueOptions('watchdogScan'));
export const screenerScanQueue = new Queue('screenerScan', queueOptions('screenerScan'));
export const dailyBriefQueue = new Queue('dailyBrief', queueOptions('dailyBrief'));
export const earningsCheckQueue = new Queue('earningsCheck', queueOptions('earningsCheck'));
export const ticketExpiryQueue = new Queue('ticketExpiry', queueOptions('ticketExpiry'));
export const alertPipelineQueue = new Queue('alertPipeline', queueOptions('alertPipeline'));

export const repeatableQueues = {
  watchdogScan: watchdogScanQueue,
  screenerScan: screenerScanQueue,
  dailyBrief: dailyBriefQueue,
  earningsCheck: earningsCheckQueue,
  ticketExpiry: ticketExpiryQueue
} as const;

export async function registerRepeatableQueueSchedules(): Promise<void> {
  const scheduler = getConfig().scheduler;

  await Promise.all([
    repeatableQueues.watchdogScan.upsertJobScheduler('watchdogScan-cron', {
      pattern: scheduler.watchdogScan.cron
    }),
    repeatableQueues.screenerScan.upsertJobScheduler('screenerScan-cron', {
      pattern: scheduler.screenerScan.cron
    }),
    repeatableQueues.dailyBrief.upsertJobScheduler('dailyBrief-cron', {
      pattern: scheduler.dailyBrief.cron
    }),
    repeatableQueues.earningsCheck.upsertJobScheduler('earningsCheck-cron', {
      pattern: scheduler.earningsCheck.cron
    }),
    repeatableQueues.ticketExpiry.upsertJobScheduler('ticketExpiry-cron', {
      pattern: scheduler.ticketExpiry.cron
    })
  ]);
}

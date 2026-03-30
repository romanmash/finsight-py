import { Queue } from 'bullmq';

import { getConfig } from './config.js';
import { getBullMqConnectionOptions } from './redis.js';

const connection = getBullMqConnectionOptions();

export const watchdogScanQueue = new Queue('watchdogScan', { connection });
export const screenerScanQueue = new Queue('screenerScan', { connection });
export const dailyBriefQueue = new Queue('dailyBrief', { connection });
export const earningsCheckQueue = new Queue('earningsCheck', { connection });
export const ticketExpiryQueue = new Queue('ticketExpiry', { connection });
export const alertPipelineQueue = new Queue('alertPipeline', { connection });

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

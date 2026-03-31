import type { WorkerOptions } from 'bullmq';

import { getConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { registerRepeatableQueueSchedules } from '../lib/queues.js';

export interface SchedulerInitResult {
  registeredJobs: string[];
  deduplicated: true;
}

export async function initScheduler(): Promise<SchedulerInitResult> {
  await registerRepeatableQueueSchedules();

  const schedulerConfig = getConfig().scheduler;
  const registeredJobs = [
    'watchdogScan',
    'screenerScan',
    'dailyBrief',
    'earningsCheck',
    'ticketExpiry'
  ].filter((jobName) => {
    const key = jobName as keyof typeof schedulerConfig;
    return schedulerConfig[key] !== undefined;
  });

  logger.info({ registeredJobs }, 'Scheduler initialized with repeatable jobs');

  return {
    registeredJobs,
    deduplicated: true
  };
}

export function buildWorkerOptions(concurrency: number): Omit<WorkerOptions, 'connection'> {
  return {
    concurrency,
    autorun: true
  };
}

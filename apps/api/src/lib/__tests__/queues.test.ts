import { beforeEach, describe, expect, it, vi } from 'vitest';

interface QueueMockInstance {
  name: string;
  upsertJobScheduler: ReturnType<typeof vi.fn>;
}

const queueInstances: QueueMockInstance[] = [];

class QueueMock {
  readonly name: string;
  readonly upsertJobScheduler = vi.fn().mockResolvedValue(undefined);

  constructor(name: string) {
    this.name = name;
    queueInstances.push(this);
  }
}

vi.mock('bullmq', () => ({
  Queue: QueueMock
}));

interface SchedulerFixture {
  scheduler: {
    watchdogScan: { cron: string; concurrency: number; retryAttempts: number; retryBackoffMs: number };
    screenerScan: { cron: string; concurrency: number; retryAttempts: number; retryBackoffMs: number };
    dailyBrief: { cron: string; concurrency: number; retryAttempts: number; retryBackoffMs: number };
    earningsCheck: { cron: string; concurrency: number; retryAttempts: number; retryBackoffMs: number };
    ticketExpiry: { cron: string; concurrency: number; retryAttempts: number; retryBackoffMs: number };
  };
}

vi.mock('../config.js', (): { getConfig: () => SchedulerFixture } => ({
  getConfig: (): SchedulerFixture => ({
    scheduler: {
      watchdogScan: { cron: '*/30 * * * *', concurrency: 1, retryAttempts: 3, retryBackoffMs: 5000 },
      screenerScan: { cron: '0 7 * * 1-5', concurrency: 1, retryAttempts: 3, retryBackoffMs: 5000 },
      dailyBrief: { cron: '0 6 * * *', concurrency: 1, retryAttempts: 2, retryBackoffMs: 5000 },
      earningsCheck: { cron: '30 7 * * 1-5', concurrency: 1, retryAttempts: 3, retryBackoffMs: 5000 },
      ticketExpiry: { cron: '0 * * * *', concurrency: 1, retryAttempts: 2, retryBackoffMs: 3000 }
    }
  })
}));

interface BullMqConnectionFixture {
  host: string;
  port: number;
}

vi.mock('../redis.js', (): { getBullMqConnectionOptions: () => BullMqConnectionFixture } => ({
  getBullMqConnectionOptions: (): BullMqConnectionFixture => ({ host: 'localhost', port: 6379 })
}));

interface QueueContract {
  name: string;
  upsertJobScheduler: (id: string, schedule: { pattern: string }) => Promise<unknown>;
}

interface QueuesModule {
  watchdogScanQueue: QueueContract;
  screenerScanQueue: QueueContract;
  dailyBriefQueue: QueueContract;
  earningsCheckQueue: QueueContract;
  ticketExpiryQueue: QueueContract;
  alertPipelineQueue: QueueContract;
  registerRepeatableQueueSchedules: () => Promise<void>;
}

async function loadQueuesModule(): Promise<QueuesModule> {
  vi.resetModules();
  queueInstances.length = 0;
  return (await import('../queues.js')) as unknown as QueuesModule;
}

describe('queue registry', () => {
  beforeEach((): void => {
    process.env.REDIS_URL = 'redis://localhost:6379/0';
    queueInstances.length = 0;
  });

  it('defines six named queues with stable contracts', async () => {
    const module = await loadQueuesModule();

    expect(module.watchdogScanQueue.name).toBe('watchdogScan');
    expect(module.screenerScanQueue.name).toBe('screenerScan');
    expect(module.dailyBriefQueue.name).toBe('dailyBrief');
    expect(module.earningsCheckQueue.name).toBe('earningsCheck');
    expect(module.ticketExpiryQueue.name).toBe('ticketExpiry');
    expect(module.alertPipelineQueue.name).toBe('alertPipeline');
  });

  it('registers repeatable schedules for five cron-driven queues only', async () => {
    const module = await loadQueuesModule();

    await module.registerRepeatableQueueSchedules();

    expect(module.watchdogScanQueue.upsertJobScheduler).toHaveBeenCalledWith('watchdogScan-cron', { pattern: '*/30 * * * *' });
    expect(module.screenerScanQueue.upsertJobScheduler).toHaveBeenCalledWith('screenerScan-cron', { pattern: '0 7 * * 1-5' });
    expect(module.dailyBriefQueue.upsertJobScheduler).toHaveBeenCalledWith('dailyBrief-cron', { pattern: '0 6 * * *' });
    expect(module.earningsCheckQueue.upsertJobScheduler).toHaveBeenCalledWith('earningsCheck-cron', { pattern: '30 7 * * 1-5' });
    expect(module.ticketExpiryQueue.upsertJobScheduler).toHaveBeenCalledWith('ticketExpiry-cron', { pattern: '0 * * * *' });
    expect(module.alertPipelineQueue.upsertJobScheduler).not.toHaveBeenCalled();
  });
});
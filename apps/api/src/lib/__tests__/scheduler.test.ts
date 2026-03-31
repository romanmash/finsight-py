import { beforeEach, describe, expect, it, vi } from 'vitest';

const registerRepeatableQueueSchedules = vi.fn().mockResolvedValue(undefined);

vi.mock('../queues.js', () => ({
  registerRepeatableQueueSchedules
}));

vi.mock('../config.js', () => ({
  getConfig: (): {
    scheduler: {
      watchdogScan: { cron: string; concurrency: number; retryAttempts: number; retryBackoffMs: number };
      screenerScan: { cron: string; concurrency: number; retryAttempts: number; retryBackoffMs: number };
      dailyBrief: { cron: string; concurrency: number; retryAttempts: number; retryBackoffMs: number };
      earningsCheck: { cron: string; concurrency: number; retryAttempts: number; retryBackoffMs: number };
      ticketExpiry: { cron: string; concurrency: number; retryAttempts: number; retryBackoffMs: number };
      alertPipeline: { concurrency: number; retryAttempts: number; retryBackoffMs: number };
    };
  } => ({
    scheduler: {
      watchdogScan: { cron: '*/30 * * * *', concurrency: 1, retryAttempts: 3, retryBackoffMs: 5000 },
      screenerScan: { cron: '0 7 * * 1-5', concurrency: 1, retryAttempts: 3, retryBackoffMs: 5000 },
      dailyBrief: { cron: '0 6 * * *', concurrency: 1, retryAttempts: 2, retryBackoffMs: 5000 },
      earningsCheck: { cron: '30 7 * * 1-5', concurrency: 1, retryAttempts: 3, retryBackoffMs: 5000 },
      ticketExpiry: { cron: '0 * * * *', concurrency: 1, retryAttempts: 2, retryBackoffMs: 3000 },
      alertPipeline: { concurrency: 2, retryAttempts: 3, retryBackoffMs: 5000 }
    }
  })
}));

describe('initScheduler', () => {
  beforeEach((): void => {
    registerRepeatableQueueSchedules.mockClear();
  });

  it('registers repeatable queue schedules and reports dedupe-safe contract', async (): Promise<void> => {
    const { initScheduler } = await import('../../scheduler/init-scheduler.js');
    const result = await initScheduler();

    expect(registerRepeatableQueueSchedules).toHaveBeenCalledTimes(1);
    expect(result.deduplicated).toBe(true);
    expect(result.registeredJobs).toContain('watchdogScan');
    expect(result.registeredJobs).toContain('screenerScan');
  });

  it('is safe to call repeatedly', async (): Promise<void> => {
    const { initScheduler } = await import('../../scheduler/init-scheduler.js');

    await initScheduler();
    await initScheduler();

    expect(registerRepeatableQueueSchedules).toHaveBeenCalledTimes(2);
  });
});

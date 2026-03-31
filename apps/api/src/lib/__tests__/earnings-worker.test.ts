import { beforeEach, describe, expect, it, vi } from 'vitest';

const runManagerMock = vi.fn();
const watchlistFindManyMock = vi.fn();

vi.mock('../../agents/manager.js', () => ({ runManager: runManagerMock }));
vi.mock('../../lib/db.js', () => ({
  db: {
    watchlistItem: {
      findMany: watchlistFindManyMock
    }
  }
}));
vi.mock('../../lib/config.js', (): { getConfig: () => { scheduler: { earningsCheck: { concurrency: number } } } } => ({
  getConfig: (): { scheduler: { earningsCheck: { concurrency: number } } } => ({ scheduler: { earningsCheck: { concurrency: 1 } } })
}));
vi.mock('../../lib/logger.js', () => ({ logger: { info: vi.fn() } }));
vi.mock('../../lib/redis.js', (): { getBullMqConnectionOptions: () => { host: string; port: number } } => ({
  getBullMqConnectionOptions: (): { host: string; port: number } => ({ host: 'localhost', port: 6379 })
}));
vi.mock('../../scheduler/init-scheduler.js', (): { buildWorkerOptions: () => { concurrency: number; autorun: boolean } } => ({
  buildWorkerOptions: (): { concurrency: number; autorun: boolean } => ({ concurrency: 1, autorun: true })
}));
vi.mock('bullmq', (): { Worker: new (_name: string, processor: () => Promise<void>) => { processor: () => Promise<void> } } => ({
  Worker: class MockWorker {
    readonly processor: () => Promise<void>;
    constructor(_name: string, processor: () => Promise<void>) {
      this.processor = processor;
    }
  }
}));

describe('earnings worker', () => {
  beforeEach((): void => {
    runManagerMock.mockReset();
    watchlistFindManyMock.mockReset();
    watchlistFindManyMock.mockResolvedValue([{ userId: 'user-1', ticker: 'NVDA' }]);
  });

  it('dispatches earnings prebrief missions', async (): Promise<void> => {
    const { createEarningsWorker } = await import('../../workers/earnings-worker.js');
    const worker = createEarningsWorker() as unknown as { processor: () => Promise<void> };

    await worker.processor();
    expect(runManagerMock).toHaveBeenCalledTimes(1);
  });
});

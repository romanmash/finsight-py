import { beforeEach, describe, expect, it, vi } from 'vitest';

const runManagerMock = vi.fn();
const userFindManyMock = vi.fn();
const watchlistFindManyMock = vi.fn();

vi.mock('../../agents/manager.js', () => ({ runManager: runManagerMock }));
vi.mock('../../lib/db.js', () => ({
  db: {
    user: {
      findMany: userFindManyMock
    },
    watchlistItem: {
      findMany: watchlistFindManyMock
    }
  }
}));
vi.mock('../../lib/config.js', (): { getConfig: () => { scheduler: { dailyBrief: { concurrency: number } } } } => ({
  getConfig: (): { scheduler: { dailyBrief: { concurrency: number } } } => ({ scheduler: { dailyBrief: { concurrency: 1 } } })
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

describe('brief worker', () => {
  beforeEach((): void => {
    runManagerMock.mockReset();
    userFindManyMock.mockReset();
    watchlistFindManyMock.mockReset();

    userFindManyMock.mockResolvedValue([{ id: 'user-1' }]);
    watchlistFindManyMock.mockResolvedValue([
      { userId: 'user-1', ticker: 'NVDA' },
      { userId: 'user-1', ticker: 'AMD' }
    ]);
  });

  it('dispatches daily brief missions for active users with watchlist tickers', async (): Promise<void> => {
    const { createBriefWorker } = await import('../../workers/brief-worker.js');
    const worker = createBriefWorker() as unknown as { processor: () => Promise<void> };

    await worker.processor();

    expect(runManagerMock).toHaveBeenCalledTimes(1);
    expect(runManagerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        missionType: 'daily_brief',
        tickers: ['NVDA', 'AMD']
      })
    );
  });
});

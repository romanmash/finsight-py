import { beforeEach, describe, expect, it, vi } from 'vitest';

const runManagerMock = vi.fn();
const alertFindUniqueMock = vi.fn();

vi.mock('../../agents/manager.js', () => ({ runManager: runManagerMock }));
vi.mock('../../lib/db.js', () => ({
  db: {
    alert: {
      findUnique: alertFindUniqueMock
    }
  }
}));
vi.mock('../../lib/config.js', (): { getConfig: () => { scheduler: { alertPipeline: { concurrency: number } } } } => ({
  getConfig: (): { scheduler: { alertPipeline: { concurrency: number } } } => ({ scheduler: { alertPipeline: { concurrency: 1 } } })
}));
vi.mock('../../lib/redis.js', (): { getBullMqConnectionOptions: () => { host: string; port: number } } => ({
  getBullMqConnectionOptions: (): { host: string; port: number } => ({ host: 'localhost', port: 6379 })
}));
vi.mock('../../scheduler/init-scheduler.js', (): { buildWorkerOptions: () => { concurrency: number; autorun: boolean } } => ({
  buildWorkerOptions: (): { concurrency: number; autorun: boolean } => ({ concurrency: 1, autorun: true })
}));
vi.mock('bullmq', (): { Worker: new (_name: string, processor: (job: { data: { alertId: string } }) => Promise<void>) => { processor: (job: { data: { alertId: string } }) => Promise<void> } } => ({
  Worker: class MockWorker {
    readonly processor: (job: { data: { alertId: string } }) => Promise<void>;
    constructor(_name: string, processor: (job: { data: { alertId: string } }) => Promise<void>) {
      this.processor = processor;
    }
  }
}));

describe('alert pipeline worker', () => {
  beforeEach((): void => {
    runManagerMock.mockReset();
    alertFindUniqueMock.mockReset();
    runManagerMock.mockResolvedValue(undefined);
    alertFindUniqueMock.mockResolvedValue({
      id: 'alert-1',
      userId: 'user-1',
      ticker: 'NVDA',
      alertType: 'price_spike',
      message: 'alert message',
      createdAt: new Date()
    });
  });

  it('dispatches alert investigation mission', async (): Promise<void> => {
    const { createAlertPipelineWorker } = await import('../../workers/alert-pipeline-worker.js');
    const worker = createAlertPipelineWorker() as unknown as { processor: (job: { data: { alertId: string } }) => Promise<void> };

    await worker.processor({ data: { alertId: 'alert-1' } });

    expect(runManagerMock).toHaveBeenCalledTimes(1);
  });
});

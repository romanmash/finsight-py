import { Hono } from 'hono';
import type { AppEnv } from '../../types/hono-context.js';
import { describe, expect, it, vi } from 'vitest';

const watchdogAddMock = vi.fn();
const screenerAddMock = vi.fn();

vi.mock('../queues.js', () => ({
  watchdogScanQueue: {
    add: watchdogAddMock
  },
  screenerScanQueue: {
    add: screenerAddMock
  }
}));

async function createTriggerApp(): Promise<Hono<AppEnv>> {
  vi.resetModules();
  const { createWatchdogRouter } = await import('../../routes/watchdog.js');
  const { createScreenerRouter } = await import('../../routes/screener.js');

  const app = new Hono<AppEnv>();
  app.route('/api/watchdog', createWatchdogRouter());
  app.route('/api/screener', createScreenerRouter());
  return app;
}

describe('manual trigger routes', () => {
  it('enqueues watchdog trigger and returns 202', async () => {
    watchdogAddMock.mockResolvedValue({});

    const app = await createTriggerApp();
    const response = await app.request('/api/watchdog/trigger', { method: 'POST' });

    expect(response.status).toBe(202);
    expect(watchdogAddMock).toHaveBeenCalledTimes(1);
  });

  it('enqueues screener trigger and returns 202', async () => {
    screenerAddMock.mockResolvedValue({});

    const app = await createTriggerApp();
    const response = await app.request('/api/screener/trigger', { method: 'POST' });

    expect(response.status).toBe(202);
    expect(screenerAddMock).toHaveBeenCalledTimes(1);
  });
});




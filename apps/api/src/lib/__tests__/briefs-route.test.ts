import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppEnv } from '../../types/hono-context.js';

const dbMock = {
  dailyBrief: { findFirst: vi.fn() },
  screenerRun: { findFirst: vi.fn() }
};

vi.mock('../../lib/db.js', () => ({ db: dbMock }));

vi.mock('../../lib/queues.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/queues.js')>('../../lib/queues.js');
  return {
    ...actual,
    screenerScanQueue: {
      add: vi.fn()
    }
  };
});

describe('briefs and screener routes', () => {
  beforeEach(() => {
    dbMock.dailyBrief.findFirst.mockReset();
    dbMock.screenerRun.findFirst.mockReset();
    dbMock.dailyBrief.findFirst.mockResolvedValue(null);
    dbMock.screenerRun.findFirst.mockResolvedValue(null);
  });

  it('serves latest brief and screener summary endpoints', async () => {
    const { createBriefsRouter } = await import('../../routes/briefs.js');
    const { createScreenerRouter } = await import('../../routes/screener.js');

    const app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('principal', { userId: 'user-1', role: 'analyst', email: 'a@a.com', name: 'Analyst', telegramHandle: null, active: true });
      await next();
    });
    app.route('/api/briefs', createBriefsRouter());
    app.route('/api/screener', createScreenerRouter());

    const briefResponse = await app.request('/api/briefs/latest');
    const screenerResponse = await app.request('/api/screener/summary');

    expect(briefResponse.status).toBe(200);
    expect(screenerResponse.status).toBe(200);
  });
});

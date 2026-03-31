import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppEnv } from '../../types/hono-context.js';

const dbMock = {
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

describe('screener route', () => {
  beforeEach(() => {
    dbMock.screenerRun.findFirst.mockReset();
    dbMock.screenerRun.findFirst.mockResolvedValue(null);
  });

  it('returns summary payload', async () => {
    const { createScreenerRouter } = await import('../../routes/screener.js');
    const app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('principal', { userId: 'admin-1', role: 'admin', email: 'a@a.com', name: 'Admin', telegramHandle: null, active: true });
      await next();
    });
    app.route('/api/screener', createScreenerRouter());

    const response = await app.request('/api/screener/summary');
    expect(response.status).toBe(200);
  });
});

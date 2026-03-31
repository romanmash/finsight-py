import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppEnv } from '../../types/hono-context.js';

const dbMock = {
  alert: { findMany: vi.fn(), updateMany: vi.fn() }
};

vi.mock('../../lib/db.js', () => ({ db: dbMock }));

describe('alerts routes', () => {
  beforeEach(() => {
    dbMock.alert.findMany.mockReset();
    dbMock.alert.updateMany.mockReset();
    dbMock.alert.findMany.mockResolvedValue([]);
    dbMock.alert.updateMany.mockResolvedValue({ count: 1 });
  });

  it('lists alerts', async () => {
    const { createAlertsRouter } = await import('../../routes/alerts.js');
    const app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('principal', { userId: 'user-1', role: 'analyst', email: 'a@a.com', name: 'Analyst', telegramHandle: null, active: true });
      await next();
    });
    app.route('/api/alerts', createAlertsRouter());

    const response = await app.request('/api/alerts');
    expect(response.status).toBe(200);
  });
});

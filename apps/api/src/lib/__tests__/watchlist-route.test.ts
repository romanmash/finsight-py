import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppEnv } from '../../types/hono-context.js';

const dbMock = {
  watchlistItem: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() }
};

vi.mock('../../lib/db.js', () => ({ db: dbMock }));

describe('watchlist routes', () => {
  beforeEach(() => {
    dbMock.watchlistItem.findMany.mockReset();
    dbMock.watchlistItem.create.mockReset();
    dbMock.watchlistItem.updateMany.mockReset();
    dbMock.watchlistItem.findMany.mockResolvedValue([]);
    dbMock.watchlistItem.create.mockResolvedValue({ id: 'w1', ticker: 'NVDA', name: 'NVDA', sector: 'tech', listType: 'interesting', addedAt: new Date() });
    dbMock.watchlistItem.updateMany.mockResolvedValue({ count: 1 });
  });

  it('lists watchlist items', async () => {
    const { createWatchlistRouter } = await import('../../routes/watchlist.js');
    const app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('principal', { userId: 'user-1', role: 'analyst', email: 'a@a.com', name: 'Analyst', telegramHandle: null, active: true });
      await next();
    });
    app.route('/api/watchlist', createWatchlistRouter());

    const response = await app.request('/api/watchlist');
    expect(response.status).toBe(200);
  });
});

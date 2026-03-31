import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppEnv } from '../../types/hono-context.js';

const dbMock = {
  portfolioItem: { findMany: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
  $transaction: vi.fn()
};

vi.mock('../../lib/db.js', () => ({ db: dbMock }));

describe('portfolio routes', () => {
  beforeEach(() => {
    dbMock.portfolioItem.findMany.mockReset();
    dbMock.$transaction.mockReset();
    dbMock.portfolioItem.findMany.mockResolvedValue([]);
    dbMock.$transaction.mockImplementation(async (handler: (tx: typeof dbMock) => Promise<void>) => handler(dbMock));
  });

  it('lists portfolio items', async () => {
    const { createPortfolioRouter } = await import('../../routes/portfolio.js');
    const app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('principal', { userId: 'user-1', role: 'analyst', email: 'a@a.com', name: 'Analyst', telegramHandle: null, active: true });
      await next();
    });
    app.route('/api/portfolio', createPortfolioRouter());

    const response = await app.request('/api/portfolio');
    expect(response.status).toBe(200);
  });
});

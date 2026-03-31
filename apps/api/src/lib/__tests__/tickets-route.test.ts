import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppEnv } from '../../types/hono-context.js';

const dbMock = {
  tradeTicket: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() }
};

vi.mock('../../lib/db.js', () => ({ db: dbMock }));

describe('tickets routes', () => {
  beforeEach(() => {
    dbMock.tradeTicket.findMany.mockReset();
    dbMock.tradeTicket.findUnique.mockReset();
    dbMock.tradeTicket.update.mockReset();
    dbMock.tradeTicket.findMany.mockResolvedValue([]);
    dbMock.tradeTicket.findUnique.mockResolvedValue({ id: 't1', status: 'pending_approval' });
    dbMock.tradeTicket.update.mockResolvedValue({ id: 't1' });
  });

  it('lists pending tickets', async () => {
    const { createTicketsRouter } = await import('../../routes/tickets.js');
    const app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('principal', { userId: 'admin-1', role: 'admin', email: 'a@a.com', name: 'Admin', telegramHandle: null, active: true });
      await next();
    });
    app.route('/api/tickets', createTicketsRouter());

    const response = await app.request('/api/tickets');
    expect(response.status).toBe(200);
  });
});

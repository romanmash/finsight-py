import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppEnv } from '../../types/hono-context.js';

const dbMock = {
  kbEntry: { findMany: vi.fn(), findFirst: vi.fn() },
  kbThesisSnapshot: { findMany: vi.fn() }
};

vi.mock('../../lib/db.js', () => ({ db: dbMock }));

describe('kb routes', () => {
  beforeEach(() => {
    dbMock.kbEntry.findMany.mockReset();
    dbMock.kbEntry.findFirst.mockReset();
    dbMock.kbThesisSnapshot.findMany.mockReset();
    dbMock.kbEntry.findMany.mockResolvedValue([]);
    dbMock.kbEntry.findFirst.mockResolvedValue(null);
    dbMock.kbThesisSnapshot.findMany.mockResolvedValue([]);
  });

  it('returns search results payload', async () => {
    const { createKbRouter } = await import('../../routes/kb.js');
    const app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
      c.set('principal', { userId: 'user-1', role: 'analyst', email: 'a@a.com', name: 'Analyst', telegramHandle: null, active: true });
      await next();
    });
    app.route('/api/kb', createKbRouter());

    const response = await app.request('/api/kb/search?q=nvda');
    expect(response.status).toBe(200);
  });
});

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppEnv } from '../../types/hono-context.js';

const dbMock = {
  mission: { findMany: vi.fn(), findUnique: vi.fn() }
};

vi.mock('../../lib/db.js', () => ({ db: dbMock }));

function createTestApp(role: 'admin' | 'analyst' = 'analyst'): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('principal', { userId: 'user-1', role, email: 'a@a.com', name: 'Analyst', telegramHandle: null, active: true });
    await next();
  });
  return app;
}

describe('missions routes', () => {
  beforeEach(() => {
    dbMock.mission.findMany.mockReset();
    dbMock.mission.findUnique.mockReset();
    dbMock.mission.findMany.mockResolvedValue([]);
    dbMock.mission.findUnique.mockResolvedValue(null);
  });

  it('lists missions', async () => {
    const { createMissionsRouter } = await import('../../routes/missions.js');
    const app = createTestApp();
    app.route('/api/missions', createMissionsRouter());

    const response = await app.request('/api/missions');
    expect(response.status).toBe(200);
  });
});

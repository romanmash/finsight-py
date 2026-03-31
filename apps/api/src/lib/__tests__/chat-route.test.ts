import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppEnv } from '../../types/hono-context.js';

const runManagerMock = vi.fn();

vi.mock('../../agents/manager.js', () => ({
  runManager: runManagerMock
}));

function createTestApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('principal', { userId: 'user-1', role: 'analyst', email: 'a@a.com', name: 'Analyst', telegramHandle: null, active: true });
    await next();
  });

  return app;
}

describe('chat route', () => {
  beforeEach(() => {
    runManagerMock.mockReset();
    runManagerMock.mockResolvedValue({ missionId: 'mission-1', response: 'ok', missionType: 'operator_query', trigger: 'pipeline' });
  });

  it('returns mission response payload', async () => {
    const { createChatRouter } = await import('../../routes/chat.js');
    const app = createTestApp();
    app.route('/api/chat', createChatRouter());

    const response = await app.request('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'What about NVDA?' })
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { missionId: string };
    expect(body.missionId).toBe('mission-1');
  });
});

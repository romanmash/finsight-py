import { Hono } from 'hono';
import type { AppEnv } from '../../types/hono-context.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildStatusMock = vi.fn();

vi.mock('../status-aggregation.js', () => ({
  buildAdminStatusSnapshot: buildStatusMock
}));

vi.mock('../db.js', () => ({
  db: { user: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() } }
}));

vi.mock('../config.js', () => ({
  getConfig: (): { auth: { bcryptRounds: number } } => ({ auth: { bcryptRounds: 10 } }),
  reloadConfig: vi.fn()
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hash') }
}));

const nineAgents = {
  manager: { state: 'idle', currentTask: null, currentMissionId: null },
  watchdog: { state: 'idle', currentTask: null, currentMissionId: null },
  screener: { state: 'idle', currentTask: null, currentMissionId: null },
  researcher: { state: 'idle', currentTask: null, currentMissionId: null },
  analyst: { state: 'idle', currentTask: null, currentMissionId: null },
  technician: { state: 'idle', currentTask: null, currentMissionId: null },
  bookkeeper: { state: 'idle', currentTask: null, currentMissionId: null },
  reporter: { state: 'idle', currentTask: null, currentMissionId: null },
  trader: { state: 'idle', currentTask: null, currentMissionId: null }
};

async function createStatusApp(): Promise<Hono<AppEnv>> {
  vi.resetModules();
  const { adminStatusHandler } = await import('../../routes/admin.js');
  const app = new Hono<AppEnv>();
  app.get('/api/admin/status', adminStatusHandler);
  return app;
}

describe('admin status route', () => {
  beforeEach(() => {
    buildStatusMock.mockReset();
  });

  it('returns status shape with all 9 agents', async () => {
    buildStatusMock.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      degraded: false,
      agents: nineAgents,
      spend: { todayTotalUsd: 0, byProvider: {} },
      mission: { active: null, recent: [] },
      health: { postgres: {}, redis: {}, mcpServers: {}, lmStudio: {}, telegramBot: {} },
      kb: { totalEntries: 0, contradictionCount: 0, lastWriteAt: null, tickersTracked: 0 },
      queues: { depths: {}, pendingAlerts: 0, pendingTickets: 0 },
      errors: []
    });

    const app = await createStatusApp();
    const response = await app.request('/api/admin/status');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { agents: Record<string, unknown> };
    expect(Object.keys(body.agents)).toHaveLength(9);
  });

  it('returns degraded markers when dependencies fail', async () => {
    buildStatusMock.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      degraded: true,
      agents: nineAgents,
      spend: { todayTotalUsd: 0, byProvider: {} },
      mission: { active: null, recent: [] },
      health: { postgres: { status: 'error' } },
      kb: { totalEntries: 0, contradictionCount: 0, lastWriteAt: null, tickersTracked: 0 },
      queues: { depths: {}, pendingAlerts: 0, pendingTickets: 0 },
      errors: [{ section: 'postgres', message: 'down' }]
    });

    const app = await createStatusApp();
    const response = await app.request('/api/admin/status');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { degraded: boolean; errors: Array<{ message: string }> };
    expect(body.degraded).toBe(true);
    expect(body.errors[0]?.message).toContain('down');
  });
});






import { Hono } from 'hono';
import type { AppEnv } from '../../types/hono-context.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reloadConfigMock = vi.fn();

vi.mock('../config.js', () => ({
  getConfig: (): { app: { logLevel: string } } => ({ app: { logLevel: 'info' } }),
  reloadConfig: reloadConfigMock
}));

vi.mock('../db.js', () => ({
  db: { user: { create: vi.fn(), findMany: vi.fn(), update: vi.fn() } }
}));

vi.mock('../status-aggregation.js', () => ({
  buildAdminStatusSnapshot: vi.fn().mockResolvedValue({})
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hash') }
}));

async function createAdminApp(): Promise<Hono<AppEnv>> {
  vi.resetModules();
  const { createAdminRouter } = await import('../../routes/admin.js');
  const app = new Hono<AppEnv>();
  app.use('/admin/*', async (c, next): Promise<void> => {
    c.set('principal', {
      userId: 'admin-1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
      telegramHandle: null,
      active: true
    });
    await next();
  });
  app.route('/admin', createAdminRouter());
  return app;
}

describe('admin config routes', () => {
  beforeEach(() => {
    reloadConfigMock.mockReset();
    reloadConfigMock.mockResolvedValue({ changed: ['auth', 'agents'] });
  });

  it('returns merged runtime config', async () => {
    const app = await createAdminApp();
    const response = await app.request('/admin/config');

    expect(response.status).toBe(200);
    expect((await response.json()) as { config: { app: { logLevel: string } } }).toEqual({
      config: { app: { logLevel: 'info' } }
    });
  });

  it('reloads config and returns changed keys', async () => {
    const app = await createAdminApp();
    const response = await app.request('/admin/config/reload', { method: 'POST' });

    expect(response.status).toBe(200);
    expect((await response.json()) as { changed: string[] }).toEqual({ changed: ['auth', 'agents'] });
  });
});






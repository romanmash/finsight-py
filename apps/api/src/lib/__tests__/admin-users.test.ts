import { Hono } from 'hono';
import type { AppEnv } from '../../types/hono-context.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const userCreateMock = vi.fn();
const userFindManyMock = vi.fn();
const userUpdateMock = vi.fn();

vi.mock('../db.js', () => ({
  db: {
    user: {
      create: userCreateMock,
      findMany: userFindManyMock,
      update: userUpdateMock
    }
  }
}));

vi.mock('../config.js', () => ({
  getConfig: (): { auth: { bcryptRounds: number } } => ({ auth: { bcryptRounds: 10 } }),
  reloadConfig: vi.fn()
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('password-hash')
  }
}));

vi.mock('../status-aggregation.js', () => ({
  buildAdminStatusSnapshot: vi.fn().mockResolvedValue({})
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

describe('admin users routes', () => {
  beforeEach(() => {
    userCreateMock.mockReset();
    userFindManyMock.mockReset();
    userUpdateMock.mockReset();
  });

  it('creates a user and excludes password hash from response', async () => {
    userCreateMock.mockResolvedValue({
      id: 'u1',
      email: 'analyst@example.com',
      name: 'Analyst',
      role: 'analyst',
      telegramHandle: null,
      active: true,
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      createdBy: 'admin-1'
    });

    const app = await createAdminApp();
    const response = await app.request('/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'analyst@example.com',
        password: 'password123',
        name: 'Analyst',
        role: 'analyst'
      })
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as { user: Record<string, unknown> };
    expect(body.user.passwordHash).toBeUndefined();
  });

  it('lists users', async () => {
    userFindManyMock.mockResolvedValue([
      {
        id: 'u1',
        email: 'viewer@example.com',
        name: 'Viewer',
        role: 'viewer',
        telegramHandle: null,
        active: true,
        createdAt: new Date('2026-03-30T00:00:00.000Z'),
        createdBy: null
      }
    ]);

    const app = await createAdminApp();
    const response = await app.request('/admin/users');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { users: Array<{ email: string }> };
    expect(body.users[0]?.email).toBe('viewer@example.com');
  });

  it('updates active state', async () => {
    userUpdateMock.mockResolvedValue({
      id: 'u1',
      email: 'viewer@example.com',
      name: 'Viewer',
      role: 'viewer',
      telegramHandle: null,
      active: false,
      createdAt: new Date('2026-03-30T00:00:00.000Z'),
      createdBy: null
    });

    const app = await createAdminApp();
    const response = await app.request('/admin/users/u1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ active: false })
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { user: { active: boolean } };
    expect(body.user.active).toBe(false);
  });
});






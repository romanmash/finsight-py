import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppEnv } from '../../types/hono-context.js';

const dispatchTelegramInternalPush = vi.fn();

vi.mock('../../lib/telegram-internal.js', () => ({ dispatchTelegramInternalPush }));

describe('telegram internal route', () => {
  beforeEach(() => {
    dispatchTelegramInternalPush.mockReset();
    dispatchTelegramInternalPush.mockResolvedValue({ delivered: true, reason: 'sent' });
    process.env.TELEGRAM_INTERNAL_TOKEN = 'test-token';
  });

  it('rejects invalid token', async () => {
    const { createTelegramInternalRouter } = await import('../../routes/telegram-internal.js');
    const app = new Hono<AppEnv>();
    app.route('/api/telegram-internal', createTelegramInternalRouter());

    const response = await app.request('/api/telegram-internal/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-token': 'bad-token' },
      body: JSON.stringify({ userId: 'u1', message: 'hello', sourceType: 'system' })
    });

    expect(response.status).toBe(403);
  });

  it('accepts valid payload and forwards dispatch', async () => {
    const { createTelegramInternalRouter } = await import('../../routes/telegram-internal.js');
    const app = new Hono<AppEnv>();
    app.route('/api/telegram-internal', createTelegramInternalRouter());

    const response = await app.request('/api/telegram-internal/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-token': 'test-token' },
      body: JSON.stringify({ userId: 'u1', message: 'hello', sourceType: 'system' })
    });

    expect(response.status).toBe(200);
    expect(dispatchTelegramInternalPush).toHaveBeenCalledWith({ userId: 'u1', message: 'hello', sourceType: 'system' });
  });
});

import { Hono } from 'hono';
import type { AppEnv } from '../../types/hono-context.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../lib/logger.js';
import { loggerMiddleware } from '../../middleware/logger.js';
import { requestIdMiddleware } from '../../middleware/request-id.js';

const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => logger);

describe('request id + logger middleware', () => {
  afterEach(() => {
    infoSpy.mockClear();
  });

  it('propagates x-request-id and logs required fields', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', requestIdMiddleware());
    app.use('*', loggerMiddleware());
    app.get('/ping', (c) => c.json({ ok: true }));

    const response = await app.request('/ping', {
      headers: {
        'x-request-id': 'req-123'
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('req-123');

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(infoSpy).mock.calls[0]?.[0] as {
      requestId: string;
      method: string;
      path: string;
      statusCode: number;
      durationMs: number;
    };

    expect(payload).toBeDefined();
    expect(payload.requestId).toBe('req-123');
    expect(payload.method).toBe('GET');
    expect(payload.path).toBe('/ping');
    expect(payload.statusCode).toBe(200);
    expect(payload.durationMs).toBeGreaterThanOrEqual(0);
  });
});

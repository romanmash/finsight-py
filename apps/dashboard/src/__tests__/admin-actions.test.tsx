import { describe, expect, it, vi } from 'vitest';

import { StatusClient } from '../status/status-client';

describe('admin action feedback contracts via StatusClient', () => {
  it('reloadConfig resolves with changed keys', async (): Promise<void> => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> =>
        new Response(JSON.stringify({ changed: ['auth', 'agents'] }), { status: 200 })
      )
    );

    const client = new StatusClient({ getAccessToken: (): string | null => 'tok', onUnauthorized: vi.fn() });
    const result = await client.reloadConfig();

    expect(result.changed).toContain('auth');
    vi.unstubAllGlobals();
  });

  it('triggerScreener resolves with queued confirmation', async (): Promise<void> => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> =>
        new Response(JSON.stringify({ queued: true, queue: 'screenerScan' }), { status: 202 })
      )
    );

    const client = new StatusClient({ getAccessToken: (): string | null => 'tok', onUnauthorized: vi.fn() });
    const result = await client.triggerScreener();

    expect(result.queued).toBe(true);
    vi.unstubAllGlobals();
  });

  it('throws actionable error on non-ok responses', async (): Promise<void> => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> =>
        new Response(JSON.stringify({ error: { message: 'Service unavailable' } }), { status: 503 })
      )
    );

    const client = new StatusClient({ getAccessToken: (): string | null => 'tok', onUnauthorized: vi.fn() });
    await expect(client.triggerWatchdog()).rejects.toThrow('Service unavailable');
    vi.unstubAllGlobals();
  });

  it('calls onUnauthorized on 403 and rejects', async (): Promise<void> => {
    const onUnauthorized = vi.fn<() => void>();
    vi.stubGlobal('fetch', vi.fn(async (): Promise<Response> => new Response('{}', { status: 403 })));

    const client = new StatusClient({ getAccessToken: (): string | null => 'tok', onUnauthorized });
    await expect(client.reloadConfig()).rejects.toThrow('Unauthorized');
    expect(onUnauthorized).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});

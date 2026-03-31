import { describe, expect, it, vi } from 'vitest';

import { StatusClient } from '../status/status-client';

describe('status client unauthorized handling', () => {
  it('calls unauthorized callback on 401', async (): Promise<void> => {
    const onUnauthorized = vi.fn<() => void>();
    vi.stubGlobal('fetch', vi.fn(async (): Promise<Response> => new Response('{}', { status: 401 })));

    const client = new StatusClient({ getAccessToken: (): string | null => 'token', onUnauthorized });

    await expect(client.fetchStatus()).rejects.toThrow('Unauthorized');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

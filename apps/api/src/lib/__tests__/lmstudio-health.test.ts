import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getLocalProviderHealthSnapshot,
  initializeLocalProviderHealthMonitor,
  probeLocalProviderHealth,
  setLocalProviderHealthSnapshotForTests,
  stopLocalProviderHealthMonitor
} from '../../providers/lmstudio-health.js';

function asResponse(value: Partial<Response>): Response {
  return value as Response;
}

describe('lmstudio health', () => {
  beforeEach((): void => {
    vi.useFakeTimers();
    setLocalProviderHealthSnapshotForTests({
      available: false,
      checkedAt: new Date(0).toISOString(),
      staleAfterMs: 0,
      reason: 'test'
    });
  });

  afterEach((): void => {
    stopLocalProviderHealthMonitor();
    vi.useRealTimers();
  });

  it('marks provider available when models endpoint returns usable model list', async (): Promise<void> => {
    const fetchMock = vi.fn(async (): Promise<Response> =>
      asResponse({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => ({ data: [{ id: 'llama-3.2' }] })
      })
    );

    const snapshot = await probeLocalProviderHealth({
      baseUrl: 'http://localhost:1234',
      fetchImpl: fetchMock as unknown as typeof fetch,
      timeoutMs: 100,
      staleAfterMs: 1000
    });

    expect(snapshot.available).toBe(true);
    expect(snapshot.modelCount).toBe(1);
  });

  it('marks provider unavailable for timeout and malformed responses', async (): Promise<void> => {
    const timeoutFetch = vi.fn(async (): Promise<Response> => {
      throw new Error('network timeout');
    });

    const timeoutSnapshot = await probeLocalProviderHealth({
      baseUrl: 'http://localhost:1234',
      fetchImpl: timeoutFetch as unknown as typeof fetch,
      timeoutMs: 10,
      staleAfterMs: 1000
    });

    expect(timeoutSnapshot.available).toBe(false);

    const malformedFetch = vi.fn(async (): Promise<Response> =>
      asResponse({
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => ({ notData: true })
      })
    );

    const malformedSnapshot = await probeLocalProviderHealth({
      baseUrl: 'http://localhost:1234',
      fetchImpl: malformedFetch as unknown as typeof fetch,
      timeoutMs: 100,
      staleAfterMs: 1000
    });

    expect(malformedSnapshot.available).toBe(false);
    expect(malformedSnapshot.reason).toBe('malformed_response');
  });

  it('refreshes probe result periodically while monitor is running', async (): Promise<void> => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        asResponse({
          ok: true,
          status: 200,
          json: async (): Promise<unknown> => ({ data: [{ id: 'llama-3.2' }] })
        })
      )
      .mockResolvedValueOnce(
        asResponse({
          ok: true,
          status: 200,
          json: async (): Promise<unknown> => ({ data: [] })
        })
      );

    await initializeLocalProviderHealthMonitor({
      baseUrl: 'http://localhost:1234',
      fetchImpl: fetchMock as unknown as typeof fetch,
      intervalMs: 100,
      timeoutMs: 50
    });

    expect(getLocalProviderHealthSnapshot().available).toBe(true);

    await vi.advanceTimersByTimeAsync(120);

    expect(getLocalProviderHealthSnapshot().available).toBe(false);
  });

  it('treats stale snapshot as unavailable', (): void => {
    setLocalProviderHealthSnapshotForTests({
      available: true,
      checkedAt: new Date(Date.now() - 2000).toISOString(),
      staleAfterMs: 1000
    });

    expect(getLocalProviderHealthSnapshot().available).toBe(false);
    expect(getLocalProviderHealthSnapshot().reason).toBe('stale');
  });
  it('returns disabled snapshot when local-provider config is unavailable', async (): Promise<void> => {
    const snapshot = await probeLocalProviderHealth();

    expect(snapshot.available).toBe(false);
    expect(snapshot.reason).toBe('disabled');

    await initializeLocalProviderHealthMonitor();

    const current = getLocalProviderHealthSnapshot();
    expect(current.available).toBe(false);
    expect(current.reason).toBe('disabled');
  });
});

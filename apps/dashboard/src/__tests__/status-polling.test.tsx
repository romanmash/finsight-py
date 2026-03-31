import React, { useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StatusClient } from '../status/status-client';
import { POLL_INTERVAL_MS, useAdminStatus, type UseAdminStatusState } from '../status/useAdminStatus';

interface HookHarnessProps {
  client: StatusClient;
  onState: (state: UseAdminStatusState) => void;
}

function HookHarness({ client, onState }: HookHarnessProps): JSX.Element {
  const state = useAdminStatus({ client });

  useEffect((): void => {
    onState(state);
  }, [onState, state]);

  return <div data-testid="hook-harness" />;
}

describe('polling cadence', () => {
  let container: HTMLDivElement;
  let root: Root;
  let visibilityState: DocumentVisibilityState;

  beforeEach((): void => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    visibilityState = 'visible';

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: (): DocumentVisibilityState => visibilityState
    });
  });

  afterEach((): void => {
    act((): void => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('locks polling interval to 3000ms', (): void => {
    expect(POLL_INTERVAL_MS).toBe(3000);
  });

  it('pauses polling when hidden and resumes when visible', async (): Promise<void> => {
    const snapshot = {
      generatedAt: new Date().toISOString(),
      degraded: false,
      agents: {},
      spend: { todayTotalUsd: 0, byProvider: {} },
      mission: { active: null, recent: [] },
      health: {
        postgres: { status: 'ok', message: null, checkedAt: '' },
        redis: { status: 'ok', message: null, checkedAt: '' },
        mcpServers: {},
        lmStudio: { status: 'ok', message: null, checkedAt: '' },
        telegramBot: { status: 'ok', message: null, checkedAt: '' }
      },
      kb: { totalEntries: 0, contradictionCount: 0, lastWriteAt: null, tickersTracked: 0 },
      queues: { depths: {}, pendingAlerts: 0, pendingTickets: 0 },
      errors: []
    };

    const fetchStatus = vi.fn(async (): Promise<typeof snapshot> => snapshot);
    const client = { fetchStatus } as unknown as StatusClient;
    const onState = vi.fn<(state: UseAdminStatusState) => void>();

    await act(async (): Promise<void> => {
      root.render(<HookHarness client={client} onState={onState} />);
      await Promise.resolve();
    });

    expect(fetchStatus).toHaveBeenCalledTimes(1);

    await act(async (): Promise<void> => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      await Promise.resolve();
    });
    expect(fetchStatus).toHaveBeenCalledTimes(2);

    visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));

    await act(async (): Promise<void> => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 3);
      await Promise.resolve();
    });
    expect(fetchStatus).toHaveBeenCalledTimes(2);

    visibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));

    await act(async (): Promise<void> => {
      await Promise.resolve();
    });
    expect(fetchStatus).toHaveBeenCalledTimes(3);
  });
});



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

describe('status resilience', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach((): void => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: (): DocumentVisibilityState => 'visible'
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

  it('retains last known snapshot when a refresh fails', async (): Promise<void> => {
    const firstSnapshot = {
      generatedAt: '2026-03-31T10:00:00.000Z',
      degraded: false,
      agents: {},
      spend: { todayTotalUsd: 1, byProvider: { openai: 1 } },
      mission: { active: null, recent: [] },
      health: {
        postgres: { status: 'ok', message: null, checkedAt: '2026-03-31T10:00:00.000Z' },
        redis: { status: 'ok', message: null, checkedAt: '2026-03-31T10:00:00.000Z' },
        mcpServers: {},
        lmStudio: { status: 'ok', message: null, checkedAt: '2026-03-31T10:00:00.000Z' },
        telegramBot: { status: 'ok', message: null, checkedAt: '2026-03-31T10:00:00.000Z' }
      },
      kb: { totalEntries: 0, contradictionCount: 0, lastWriteAt: null, tickersTracked: 0 },
      queues: { depths: {}, pendingAlerts: 0, pendingTickets: 0 },
      errors: []
    };

    const fetchStatus = vi
      .fn<() => Promise<typeof firstSnapshot>>()
      .mockResolvedValueOnce(firstSnapshot)
      .mockRejectedValueOnce(new Error('network timeout'));

    const client = { fetchStatus } as unknown as StatusClient;
    const observedStates: UseAdminStatusState[] = [];

    await act(async (): Promise<void> => {
      root.render(<HookHarness client={client} onState={(state): void => { observedStates.push(state); }} />);
      await Promise.resolve();
    });

    const afterFirstSuccess = observedStates.at(-1);
    expect(afterFirstSuccess?.snapshot?.generatedAt).toBe('2026-03-31T10:00:00.000Z');
    expect(afterFirstSuccess?.isDegradedConnection).toBe(false);

    await act(async (): Promise<void> => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      await Promise.resolve();
    });

    const afterFailure = observedStates.at(-1);
    expect(afterFailure?.snapshot?.generatedAt).toBe('2026-03-31T10:00:00.000Z');
    expect(afterFailure?.isDegradedConnection).toBe(true);
    expect(afterFailure?.error).toContain('network timeout');
  });
});



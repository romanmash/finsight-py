import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { StatusClient } from './status-client';
import type { AdminStatusSnapshot } from './status-types';

export const POLL_INTERVAL_MS = 3000;

export interface UseAdminStatusState {
  snapshot: AdminStatusSnapshot | null;
  isLoading: boolean;
  isDegradedConnection: boolean;
  lastSuccessAt: string | null;
  error: string | null;
  refresh: () => Promise<void>;
}

interface UseAdminStatusParams {
  client: StatusClient;
}

export function useAdminStatus(params: UseAdminStatusParams): UseAdminStatusState {
  const [snapshot, setSnapshot] = useState<AdminStatusSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDegradedConnection, setIsDegradedConnection] = useState<boolean>(false);
  const [lastSuccessAt, setLastSuccessAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef<() => Promise<void>>();

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const next = await params.client.fetchStatus();
      setSnapshot(next);
      setLastSuccessAt(next.generatedAt);
      setIsDegradedConnection(false);
      setError(null);
    } catch (refreshError) {
      setIsDegradedConnection(true);
      setError(refreshError instanceof Error ? refreshError.message : 'Status refresh failed');
    } finally {
      setIsLoading(false);
    }
  }, [params.client]);

  refreshRef.current = refresh;

  useEffect(() => {
    let intervalId: number | null = null;

    const updateLifecycle = (): void => {
      if (document.visibilityState === 'hidden') {
        if (intervalId !== null) {
          window.clearInterval(intervalId);
          intervalId = null;
        }
        return;
      }

      if (intervalId === null) {
        void refreshRef.current?.();
        intervalId = window.setInterval(() => {
          void refreshRef.current?.();
        }, POLL_INTERVAL_MS);
      }
    };

    updateLifecycle();
    document.addEventListener('visibilitychange', updateLifecycle);

    return (): void => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      document.removeEventListener('visibilitychange', updateLifecycle);
    };
  }, []);

  return useMemo<UseAdminStatusState>(
    () => ({
      snapshot,
      isLoading,
      isDegradedConnection,
      lastSuccessAt,
      error,
      refresh
    }),
    [snapshot, isLoading, isDegradedConnection, lastSuccessAt, error, refresh]
  );
}

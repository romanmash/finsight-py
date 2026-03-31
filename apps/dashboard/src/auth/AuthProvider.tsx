import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import type { AdminUser } from '../status/status-types';
import { loginRequest, meRequest, refreshRequest } from '../status/status-client';
import { buildSession, shouldRenewSession, type SessionState } from './session';

interface AuthContextValue {
  session: SessionState | null;
  isReady: boolean;
  isAuthenticated: boolean;
  loginError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshSessionNow: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function refreshAndResolveUser(previousUser: AdminUser | null): Promise<SessionState> {
  const refreshed = await refreshRequest();

  let user = previousUser;
  if (user === null) {
    const me = await meRequest(refreshed.accessToken);
    user = me.user;
  }

  return buildSession(refreshed.accessToken, user);
}

export function AuthProvider({ children }: PropsWithChildren): JSX.Element {
  const [session, setSession] = useState<SessionState | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const logout = useCallback((): void => {
    setSession(null);
    setLoginError(null);
  }, []);

  const refreshSessionNow = useCallback(async (): Promise<void> => {
    try {
      const refreshed = await refreshAndResolveUser(session?.user ?? null);
      setSession(refreshed);
      setLoginError(null);
    } catch {
      logout();
      throw new Error('Session renewal failed');
    }
  }, [logout, session?.user]);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const result = await loginRequest(email, password);
    setSession(buildSession(result.accessToken, result.user));
    setLoginError(null);
  }, []);

  useEffect(() => {
    let alive = true;

    (async (): Promise<void> => {
      try {
        const refreshed = await refreshAndResolveUser(null);
        if (alive) {
          setSession(refreshed);
        }
      } catch {
        if (alive) {
          setSession(null);
        }
      } finally {
        if (alive) {
          setIsReady(true);
        }
      }
    })();

    return (): void => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (session === null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (!shouldRenewSession(session)) {
        return;
      }

      void refreshSessionNow().catch(() => {
        setLoginError('Session expired. Please sign in again.');
      });
    }, 10_000);

    return (): void => {
      window.clearInterval(intervalId);
    };
  }, [refreshSessionNow, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isReady,
      isAuthenticated: session !== null,
      loginError,
      login,
      logout,
      refreshSessionNow
    }),
    [isReady, login, loginError, logout, refreshSessionNow, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}

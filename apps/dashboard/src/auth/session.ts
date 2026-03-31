import type { AdminUser } from '../status/status-types';

const RENEW_LEAD_MS = 60_000;

export interface SessionState {
  accessToken: string;
  user: AdminUser;
  expiresAtMs: number;
}

export function decodeJwtExpiryMs(token: string): number {
  const segments = token.split('.');
  if (segments.length < 2) {
    return 0;
  }

  const payload = segments[1];
  if (payload === undefined) {
    return 0;
  }

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(paddedBase64)) as { exp?: number };
    const exp = decoded.exp;
    if (typeof exp !== 'number') {
      return 0;
    }

    return exp * 1000;
  } catch {
    return 0;
  }
}

export function buildSession(accessToken: string, user: AdminUser): SessionState {
  return {
    accessToken,
    user,
    expiresAtMs: decodeJwtExpiryMs(accessToken)
  };
}

export function shouldRenewSession(session: SessionState | null, nowMs: number = Date.now()): boolean {
  if (session === null) {
    return false;
  }

  if (session.expiresAtMs <= 0) {
    return true;
  }

  return session.expiresAtMs - nowMs <= RENEW_LEAD_MS;
}

export function authHeaderValue(session: SessionState | null): string | null {
  if (session === null) {
    return null;
  }

  return `Bearer ${session.accessToken}`;
}



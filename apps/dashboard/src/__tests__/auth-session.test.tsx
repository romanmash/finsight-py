import { describe, expect, it } from 'vitest';

import { authHeaderValue, buildSession, shouldRenewSession } from '../auth/session';

const MOCK_USER = {
  id: 'u1',
  email: 'admin@test.com',
  name: 'Admin',
  role: 'admin',
  telegramHandle: null,
  active: true
};

describe('auth session continuity', () => {
  it('extracts expiry from JWT exp claim', (): void => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = btoa(JSON.stringify({ exp }));
    const session = buildSession(`h.${payload}.s`, MOCK_USER);

    expect(session.expiresAtMs).toBe(exp * 1000);
  });

  it('returns expiresAtMs=0 for malformed token payload', (): void => {
    const session = buildSession('not.a.jwt', MOCK_USER);
    expect(session.expiresAtMs).toBe(0);
  });

  it('renews when expiry is unknown', (): void => {
    const session = buildSession('bad.token.here', MOCK_USER);
    expect(shouldRenewSession(session, Date.now())).toBe(true);
  });

  it('keeps session when outside lead window', (): void => {
    const exp = Math.floor((Date.now() + 10 * 60 * 1000) / 1000);
    const payload = btoa(JSON.stringify({ exp }));
    const session = buildSession(`h.${payload}.s`, MOCK_USER);

    expect(shouldRenewSession(session, Date.now())).toBe(false);
  });

  it('renews within lead window', (): void => {
    const exp = Math.floor((Date.now() + 45 * 1000) / 1000);
    const payload = btoa(JSON.stringify({ exp }));
    const session = buildSession(`h.${payload}.s`, MOCK_USER);

    expect(shouldRenewSession(session, Date.now())).toBe(true);
  });

  it('builds bearer auth header when session exists', (): void => {
    const exp = Math.floor((Date.now() + 3600 * 1000) / 1000);
    const payload = btoa(JSON.stringify({ exp }));
    const token = `h.${payload}.s`;
    const session = buildSession(token, MOCK_USER);

    expect(authHeaderValue(session)).toBe(`Bearer ${token}`);
  });

  it('returns null auth header when no session exists', (): void => {
    expect(authHeaderValue(null)).toBeNull();
  });
});

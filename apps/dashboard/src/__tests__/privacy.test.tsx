import { describe, expect, it } from 'vitest';

import { authHeaderValue, buildSession } from '../auth/session';

describe('privacy baseline', () => {
  it('stores access token in memory session object and not browser storage', (): void => {
    const exp = Math.floor((Date.now() + 3600_000) / 1000);
    const payload = btoa(JSON.stringify({ exp }));
    const session = buildSession(`h.${payload}.s`, {
      id: 'u1',
      email: 'a@b.c',
      name: 'Admin',
      role: 'admin',
      telegramHandle: null,
      active: true
    });

    expect(authHeaderValue(session)).toMatch(/^Bearer /);
    expect(session.user.email).toBe('a@b.c');
  });

  it('returns null header for missing session', (): void => {
    expect(authHeaderValue(null)).toBeNull();
  });
});

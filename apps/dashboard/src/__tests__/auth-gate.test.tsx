import { describe, expect, it } from 'vitest';

import { buildSession, shouldRenewSession } from '../auth/session';

describe('auth gate - session guard logic', () => {
  it('reports unauthenticated when session is null', (): void => {
    expect(shouldRenewSession(null)).toBe(false);
  });

  it('does not renew when expiry is far in the future', (): void => {
    const exp = Math.floor((Date.now() + 10 * 60 * 1000) / 1000);
    const payload = btoa(JSON.stringify({ exp }));
    const token = `x.${payload}.y`;

    const session = buildSession(token, {
      id: 'u1',
      email: 'admin@test.com',
      name: 'Admin',
      role: 'admin',
      telegramHandle: null,
      active: true
    });

    expect(shouldRenewSession(session, Date.now())).toBe(false);
  });

  it('requires renewal inside 60-second lead window', (): void => {
    const exp = Math.floor((Date.now() + 30 * 1000) / 1000);
    const payload = btoa(JSON.stringify({ exp }));
    const token = `x.${payload}.y`;

    const session = buildSession(token, {
      id: 'u1',
      email: 'admin@test.com',
      name: 'Admin',
      role: 'admin',
      telegramHandle: null,
      active: true
    });

    expect(shouldRenewSession(session, Date.now())).toBe(true);
  });
});

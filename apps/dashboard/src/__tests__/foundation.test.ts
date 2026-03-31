import { describe, expect, it } from 'vitest';

import { buildSession, decodeJwtExpiryMs, shouldRenewSession } from '../auth/session';

describe('session helpers', () => {
  it('decodes JWT expiry from payload', () => {
    const payload = btoa(JSON.stringify({ exp: 2_000_000_000 }));
    const token = `x.${payload}.y`;
    expect(decodeJwtExpiryMs(token)).toBe(2_000_000_000_000);
  });

  it('evaluates renew lead window', () => {
    const session = buildSession(`x.${btoa(JSON.stringify({ exp: 100 }))}.y`, {
      id: 'u',
      email: 'a@b.c',
      name: 'A',
      role: 'admin',
      telegramHandle: null,
      active: true
    });

    expect(shouldRenewSession(session, 100_000)).toBe(true);
  });
});

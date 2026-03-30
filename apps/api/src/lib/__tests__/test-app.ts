import type { Hono } from 'hono';

import { createApp } from '../../app.js';
import type { AppEnv } from '../../types/hono-context.js';

export function createTestApp(): Hono<AppEnv> {
  return createApp();
}

export function extractCookie(headers: Headers, cookieName: string): string | null {
  const setCookie = headers.get('set-cookie');
  if (setCookie === null) {
    return null;
  }

  const rawPair = setCookie.split(';')[0] ?? '';
  const eqIndex = rawPair.indexOf('=');
  if (eqIndex === -1) {
    return null;
  }

  const name = rawPair.slice(0, eqIndex);
  const value = rawPair.slice(eqIndex + 1);
  if (name !== cookieName) {
    return null;
  }

  return value;
}

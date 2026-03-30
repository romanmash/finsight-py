import { createHash, randomUUID } from 'node:crypto';

import { SignJWT, jwtVerify } from 'jose';

import { getConfig } from './config.js';
import { db } from './db.js';
import { serviceUnavailable, unauthorized } from './errors.js';
import { redis } from './redis.js';
import type { AuthenticatedPrincipal, UserRole } from '../types/hono-context.js';

const REFRESH_REDIS_KEY_PREFIX = 'auth:refresh:';
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_DAY = 86400;

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  email: string;
  name: string;
  telegramHandle: string | null;
}

export interface RefreshSession {
  sessionId: string;
  refreshToken: string;
  expiresAt: Date;
}

interface RefreshSessionResult {
  accessToken: string;
  refreshSession: RefreshSession;
  principal: AuthenticatedPrincipal;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (secret === undefined || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }

  return new TextEncoder().encode(secret);
}

function createRefreshRedisKey(tokenHash: string): string {
  return `${REFRESH_REDIS_KEY_PREFIX}${tokenHash}`;
}

function hashRefreshToken(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex');
}

function getAccessTokenExpirySeconds(): number {
  const minutes = getConfig().auth.accessTokenExpiryMinutes;
  return minutes * SECONDS_PER_MINUTE;
}

function getRefreshTokenExpirySeconds(): number {
  const days = getConfig().auth.refreshTokenExpiryDays;
  return days * SECONDS_PER_DAY;
}

function toPrincipal(payload: AccessTokenPayload): AuthenticatedPrincipal {
  return {
    userId: payload.sub,
    role: payload.role,
    email: payload.email,
    name: payload.name,
    telegramHandle: payload.telegramHandle,
    active: true
  };
}

export async function issueAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({
    role: payload.role,
    email: payload.email,
    name: payload.name,
    telegramHandle: payload.telegramHandle
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${String(getConfig().auth.accessTokenExpiryMinutes)}m`)
    .sign(getJwtSecret());
}

export async function verifyAccessToken(accessToken: string): Promise<AuthenticatedPrincipal> {
  try {
    const result = await jwtVerify(accessToken, getJwtSecret());
    const role = String(result.payload.role);
    if (role !== 'admin' && role !== 'analyst' && role !== 'viewer') {
      throw unauthorized('Invalid token role');
    }

    const payload: AccessTokenPayload = {
      sub: String(result.payload.sub),
      role,
      email: String(result.payload.email),
      name: String(result.payload.name),
      telegramHandle:
        result.payload.telegramHandle === null || result.payload.telegramHandle === undefined
          ? null
          : String(result.payload.telegramHandle)
    };

    return toPrincipal(payload);
  } catch {
    throw unauthorized('Invalid or expired access token');
  }
}

export async function ensureRedisSessionStoreAvailable(): Promise<void> {
  try {
    await redis.ping();
  } catch {
    throw serviceUnavailable('Redis session store unavailable');
  }
}

export async function createRefreshSession(userId: string): Promise<RefreshSession> {
  const refreshToken = randomUUID();
  const tokenHash = hashRefreshToken(refreshToken);
  const expirySeconds = getRefreshTokenExpirySeconds();
  const expiresAt = new Date(Date.now() + expirySeconds * MILLISECONDS_PER_SECOND);

  const created = await db.refreshToken.create({
    data: {
      userId,
      token: tokenHash,
      expiresAt
    }
  });

  await redis.set(createRefreshRedisKey(tokenHash), created.id, 'EX', expirySeconds);

  return {
    sessionId: created.id,
    refreshToken,
    expiresAt
  };
}

async function buildAccessPayload(userId: string): Promise<AccessTokenPayload> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      email: true,
      name: true,
      telegramHandle: true,
      active: true
    }
  });

  if (user === null || !user.active) {
    throw unauthorized('User is inactive or missing');
  }

  return {
    sub: user.id,
    role: user.role as UserRole,
    email: user.email,
    name: user.name,
    telegramHandle: user.telegramHandle
  };
}

export async function refreshSession(refreshToken: string): Promise<RefreshSessionResult> {
  const tokenHash = hashRefreshToken(refreshToken);
  const existing = await db.refreshToken.findUnique({
    where: { token: tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true
    }
  });

  if (existing === null || existing.expiresAt.getTime() <= Date.now()) {
    throw unauthorized('Refresh token is invalid or expired');
  }

  const redisSession = await redis.get(createRefreshRedisKey(tokenHash));
  if (redisSession === null) {
    throw unauthorized('Refresh token was revoked');
  }

  await db.refreshToken.delete({ where: { token: tokenHash } });
  await redis.del(createRefreshRedisKey(tokenHash));

  const [payload, refresh] = await Promise.all([
    buildAccessPayload(existing.userId),
    createRefreshSession(existing.userId)
  ]);

  const accessToken = await issueAccessToken(payload);

  return {
    accessToken,
    refreshSession: refresh,
    principal: toPrincipal(payload)
  };
}

export async function revokeRefreshSession(refreshToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(refreshToken);

  await db.refreshToken.deleteMany({ where: { token: tokenHash } });
  await redis.del(createRefreshRedisKey(tokenHash));
}

export function getAccessTokenExpirySecondsForTests(): number {
  return getAccessTokenExpirySeconds();
}

export function getRefreshTokenExpirySecondsForTests(): number {
  return getRefreshTokenExpirySeconds();
}

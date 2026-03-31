import { RedisKey, redis } from '../../lib/redis.js';
import { getConfig } from '../../lib/config.js';
import type { CollectorAgentName, CollectorStatePayload } from '../../types/collectors.js';

interface CollectorStateDependencies {
  setRedis: (key: string, value: string, mode: 'EX', ttlSeconds: number) => Promise<unknown>;
  now: () => Date;
  ttlSeconds: () => number;
}

const DEFAULT_STATE_TTL_SECONDS = 600;

function resolveCollectorStateTtlSeconds(): number {
  try {
    return getConfig().app.collector.stateTtlSeconds;
  } catch {
    return DEFAULT_STATE_TTL_SECONDS;
  }
}

function defaultDependencies(): CollectorStateDependencies {
  return {
    setRedis: (key: string, value: string, mode: 'EX', ttlSeconds: number) => redis.set(key, value, mode, ttlSeconds),
    now: () => new Date(),
    ttlSeconds: () => resolveCollectorStateTtlSeconds()
  };
}

function stringifyState(payload: CollectorStatePayload): string {
  return JSON.stringify(payload);
}

export async function setCollectorState(
  agentName: CollectorAgentName,
  payload: CollectorStatePayload,
  deps: CollectorStateDependencies = defaultDependencies()
): Promise<void> {
  await deps.setRedis(RedisKey.agentState(agentName), stringifyState(payload), 'EX', deps.ttlSeconds());
}

export async function setCollectorActive(
  agentName: CollectorAgentName,
  currentTask: string,
  currentMissionId?: string,
  deps?: CollectorStateDependencies
): Promise<void> {
  const resolved = deps ?? defaultDependencies();
  const payload: CollectorStatePayload = {
    state: 'active',
    currentTask,
    startedAt: resolved.now().toISOString(),
    ...(currentMissionId !== undefined ? { currentMissionId } : {})
  };

  await setCollectorState(agentName, payload, resolved);
}

export async function setCollectorIdle(
  agentName: CollectorAgentName,
  lastActivitySummary: string,
  deps?: CollectorStateDependencies
): Promise<void> {
  const resolved = deps ?? defaultDependencies();
  await setCollectorState(
    agentName,
    {
      state: 'idle',
      lastActivitySummary,
      lastActiveAt: resolved.now().toISOString()
    },
    resolved
  );
}

export async function setCollectorError(
  agentName: CollectorAgentName,
  errorMessage: string,
  deps?: CollectorStateDependencies
): Promise<void> {
  const resolved = deps ?? defaultDependencies();
  await setCollectorState(
    agentName,
    {
      state: 'error',
      errorMessage,
      lastActiveAt: resolved.now().toISOString()
    },
    resolved
  );
}

export interface RecoverableFailure {
  recoverable: true;
  code: 'MALFORMED_OUTPUT' | 'UPSTREAM_UNAVAILABLE' | 'VALIDATION_ERROR';
  message: string;
  details?: Record<string, unknown>;
}

export function createRecoverableFailure(
  code: RecoverableFailure['code'],
  message: string,
  details?: Record<string, unknown>
): RecoverableFailure {
  return {
    recoverable: true,
    code,
    message,
    ...(details !== undefined ? { details } : {})
  };
}

export function isRecoverableFailure(value: unknown): value is RecoverableFailure {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Partial<RecoverableFailure>;
  return record.recoverable === true && typeof record.code === 'string' && typeof record.message === 'string';
}
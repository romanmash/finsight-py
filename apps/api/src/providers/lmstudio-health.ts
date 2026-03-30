import { getConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import type { LocalProviderHealthState } from '../types/agent-infrastructure.js';

const DISABLED_STALE_AFTER_MS = 0;

let localProviderHealthState: LocalProviderHealthState = {
  available: false,
  checkedAt: new Date(0).toISOString(),
  staleAfterMs: DISABLED_STALE_AFTER_MS,
  reason: 'uninitialized'
};

let healthTimer: NodeJS.Timeout | null = null;

export interface LmStudioProbeOptions {
  baseUrl?: string;
  timeoutMs?: number;
  staleAfterMs?: number;
  fetchImpl?: typeof fetch;
  now?: Date;
}

export interface LocalProviderMonitorOptions {
  baseUrl?: string;
  intervalMs?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface LmStudioModelsResponse {
  data?: Array<{ id?: string }>;
}

interface LocalProviderRuntimeConfig {
  enabled: boolean;
  baseUrl?: string;
  intervalMs?: number;
  timeoutMs?: number;
}

function getLocalProviderRuntimeConfig(): LocalProviderRuntimeConfig {
  try {
    const localProvider = getConfig().mcp.localProvider;

    if (localProvider === undefined) {
      return { enabled: false };
    }

    return {
      enabled: true,
      baseUrl: localProvider.baseUrl,
      intervalMs: localProvider.healthProbeIntervalMs,
      timeoutMs: localProvider.healthProbeTimeoutMs
    };
  } catch {
    return { enabled: false };
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

function parseProbeResponse(payload: unknown): { available: boolean; reason?: string; modelCount?: number } {
  if (typeof payload !== 'object' || payload === null) {
    return { available: false, reason: 'malformed_response' };
  }

  const typedPayload = payload as LmStudioModelsResponse;
  if (!Array.isArray(typedPayload.data)) {
    return { available: false, reason: 'malformed_response' };
  }

  const modelCount = typedPayload.data.filter((model) => typeof model.id === 'string' && model.id.length > 0).length;

  if (modelCount < 1) {
    return { available: false, reason: 'no_usable_models', modelCount };
  }

  return { available: true, modelCount };
}

export function normalizeProbeResult(
  payload: unknown,
  checkedAt: Date,
  staleAfterMs: number
): LocalProviderHealthState {
  const parsed = parseProbeResponse(payload);

  const snapshot: LocalProviderHealthState = {
    available: parsed.available,
    checkedAt: checkedAt.toISOString(),
    staleAfterMs
  };

  if (parsed.reason !== undefined) {
    snapshot.reason = parsed.reason;
  }

  if (parsed.modelCount !== undefined) {
    snapshot.modelCount = parsed.modelCount;
  }

  return snapshot;
}

function createDisabledSnapshot(now: Date): LocalProviderHealthState {
  return {
    available: false,
    checkedAt: now.toISOString(),
    staleAfterMs: DISABLED_STALE_AFTER_MS,
    reason: 'disabled'
  };
}

export function getLocalProviderHealthSnapshot(now?: Date): LocalProviderHealthState {
  const currentTime = now ?? new Date();
  const checkedAtMs = Date.parse(localProviderHealthState.checkedAt);

  if (!Number.isNaN(checkedAtMs) && localProviderHealthState.staleAfterMs > 0) {
    const ageMs = currentTime.getTime() - checkedAtMs;
    if (ageMs > localProviderHealthState.staleAfterMs) {
      return {
        ...localProviderHealthState,
        available: false,
        reason: 'stale'
      };
    }
  }

  return localProviderHealthState;
}

export function setLocalProviderHealthSnapshotForTests(snapshot: LocalProviderHealthState): void {
  localProviderHealthState = snapshot;
}

export async function probeLocalProviderHealth(options?: LmStudioProbeOptions): Promise<LocalProviderHealthState> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const checkedAt = options?.now ?? new Date();

  const runtimeConfig = getLocalProviderRuntimeConfig();
  const baseUrlRaw = options?.baseUrl ?? runtimeConfig.baseUrl;
  const timeoutMs = options?.timeoutMs ?? runtimeConfig.timeoutMs;

  if (baseUrlRaw === undefined || timeoutMs === undefined) {
    const snapshot = createDisabledSnapshot(checkedAt);
    localProviderHealthState = snapshot;
    logger.info('Local-provider probing disabled by runtime configuration');
    return snapshot;
  }

  const staleAfterMs = options?.staleAfterMs ?? (runtimeConfig.intervalMs !== undefined ? runtimeConfig.intervalMs * 2 : timeoutMs * 2);
  const baseUrl = normalizeBaseUrl(baseUrlRaw);

  try {
    const response = await fetchImpl(`${baseUrl}/v1/models`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!response.ok) {
      const snapshot: LocalProviderHealthState = {
        available: false,
        checkedAt: checkedAt.toISOString(),
        staleAfterMs,
        reason: `http_${String(response.status)}`
      };

      localProviderHealthState = snapshot;
      logger.warn({ status: response.status }, 'Local-provider probe returned non-success status');

      return snapshot;
    }

    const body = (await response.json()) as unknown;
    const snapshot = normalizeProbeResult(body, checkedAt, staleAfterMs);
    localProviderHealthState = snapshot;

    logger.info(
      {
        available: snapshot.available,
        modelCount: snapshot.modelCount,
        reason: snapshot.reason
      },
      'Local-provider health probe completed'
    );

    return snapshot;
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'unreachable';

    const snapshot: LocalProviderHealthState = {
      available: false,
      checkedAt: checkedAt.toISOString(),
      staleAfterMs,
      reason
    };

    localProviderHealthState = snapshot;

    logger.warn({ reason, error: (error as Error).message }, 'Local-provider health probe failed');

    return snapshot;
  }
}

export async function initializeLocalProviderHealthMonitor(options?: LocalProviderMonitorOptions): Promise<void> {
  const runtimeConfig = getLocalProviderRuntimeConfig();
  const baseUrl = options?.baseUrl ?? runtimeConfig.baseUrl;
  const intervalMs = options?.intervalMs ?? runtimeConfig.intervalMs;
  const timeoutMs = options?.timeoutMs ?? runtimeConfig.timeoutMs;

  if (baseUrl === undefined || intervalMs === undefined || timeoutMs === undefined) {
    localProviderHealthState = createDisabledSnapshot(new Date());
    logger.info('Local-provider health monitor disabled by runtime configuration');

    if (healthTimer !== null) {
      clearInterval(healthTimer);
      healthTimer = null;
    }

    return;
  }

  const firstProbeOptions: LmStudioProbeOptions = {
    baseUrl,
    timeoutMs,
    staleAfterMs: intervalMs * 2
  };

  if (options?.fetchImpl !== undefined) {
    firstProbeOptions.fetchImpl = options.fetchImpl;
  }

  await probeLocalProviderHealth(firstProbeOptions);

  if (healthTimer !== null) {
    clearInterval(healthTimer);
  }

  healthTimer = setInterval(() => {
    const periodicProbeOptions: LmStudioProbeOptions = {
      baseUrl,
      timeoutMs,
      staleAfterMs: intervalMs * 2
    };

    if (options?.fetchImpl !== undefined) {
      periodicProbeOptions.fetchImpl = options.fetchImpl;
    }

    void probeLocalProviderHealth(periodicProbeOptions);
  }, intervalMs);
}

export function stopLocalProviderHealthMonitor(): void {
  if (healthTimer !== null) {
    clearInterval(healthTimer);
    healthTimer = null;
  }
}
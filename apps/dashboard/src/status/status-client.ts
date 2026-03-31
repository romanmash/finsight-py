import type { AdminStatusSnapshot, AdminUser } from './status-types';

export interface ApiClientOptions {
  getAccessToken: () => string | null;
  onUnauthorized: () => void;
}

interface JsonErrorPayload {
  error?: {
    message?: string;
  };
}

const DEFAULT_API_BASE = '';

function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return fromEnv ?? DEFAULT_API_BASE;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as JsonErrorPayload;
    return payload.error?.message ?? `Request failed (${String(response.status)})`;
  } catch {
    return `Request failed (${String(response.status)})`;
  }
}

export class StatusClient {
  private readonly getAccessToken: () => string | null;

  private readonly onUnauthorized: () => void;

  private readonly apiBaseUrl: string;

  public constructor(options: ApiClientOptions) {
    this.getAccessToken = options.getAccessToken;
    this.onUnauthorized = options.onUnauthorized;
    this.apiBaseUrl = getApiBaseUrl();
  }

  private async requestJson<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
    const accessToken = this.getAccessToken();
    const headers = new Headers(init?.headers);
    headers.set('Content-Type', 'application/json');
    if (accessToken !== null) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const response = await fetch(`${this.apiBaseUrl}${path}`, {
      ...init,
      headers,
      credentials: 'include'
    });

    if (response.status === 401 || response.status === 403) {
      this.onUnauthorized();
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    return (await response.json()) as TResponse;
  }

  public async fetchStatus(): Promise<AdminStatusSnapshot> {
    return this.requestJson<AdminStatusSnapshot>('/api/admin/status');
  }

  public async reloadConfig(): Promise<{ changed: string[] }> {
    return this.requestJson<{ changed: string[] }>('/admin/config/reload', { method: 'POST' });
  }

  public async triggerScreener(): Promise<{ queued: boolean; queue?: string }> {
    return this.requestJson<{ queued: boolean; queue?: string }>('/api/screener/trigger', { method: 'POST' });
  }

  public async triggerWatchdog(): Promise<{ queued: boolean; queue?: string }> {
    return this.requestJson<{ queued: boolean; queue?: string }>('/api/watchdog/trigger', { method: 'POST' });
  }
}

export async function loginRequest(email: string, password: string): Promise<{ accessToken: string; user: AdminUser }> {
  const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as { accessToken: string; user: AdminUser };
}

export async function refreshRequest(): Promise<{ accessToken: string }> {
  const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
    method: 'POST',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as { accessToken: string };
}

export async function meRequest(accessToken: string): Promise<{ user: AdminUser }> {
  const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as { user: AdminUser };
}

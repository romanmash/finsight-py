import { URL } from 'node:url';

interface ApiClientOptions {
  baseUrl: string;
  accessToken: string;
}

interface JsonRequestInit {
  method?: string;
  headers?: Record<string, string>;
  bodyObject?: unknown;
}

export interface ChatResponse {
  response: string;
  missionType?: string;
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.accessToken = options.accessToken;
  }

  private async request<T>(path: string, init: JsonRequestInit = {}): Promise<T> {
    const url = new URL(path, this.baseUrl);

    const requestInit: RequestInit = {
      headers: {
        authorization: `Bearer ${this.accessToken}`,
        'content-type': 'application/json',
        ...(init.headers ?? {})
      }
    };

    if (init.method !== undefined) {
      requestInit.method = init.method;
    }

    if (init.bodyObject !== undefined) {
      requestInit.body = JSON.stringify(init.bodyObject);
    }

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      throw new Error(`API ${path} failed with ${response.status}`);
    }

    return response.json() as Promise<T>;
  }

  async chat(message: string): Promise<ChatResponse> {
    return this.request<ChatResponse>('/api/chat', {
      method: 'POST',
      bodyObject: { message }
    });
  }

  async latestBrief(): Promise<{ brief: { rawText: string } | null }> {
    return this.request<{ brief: { rawText: string } | null }>('/api/briefs/latest');
  }

  async thesis(ticker: string): Promise<{ thesis: { content: string } | null }> {
    return this.request<{ thesis: { content: string } | null }>(`/api/kb/thesis/${encodeURIComponent(ticker)}`);
  }

  async history(ticker: string): Promise<{ history: Array<{ createdAt: string; thesis: string; changeSummary: string | null }> }> {
    return this.request<{ history: Array<{ createdAt: string; thesis: string; changeSummary: string | null }> }>(`/api/kb/history/${encodeURIComponent(ticker)}`);
  }

  async screenerSummary(): Promise<{ summary: unknown | null }> {
    return this.request<{ summary: unknown | null }>('/api/screener/summary');
  }

  async alerts(): Promise<{ alerts: unknown[] }> {
    return this.request<{ alerts: unknown[] }>('/api/alerts');
  }

  async acknowledgeAlert(alertId: string): Promise<{ acknowledged: boolean }> {
    return this.request<{ acknowledged: boolean }>(`/api/alerts/${encodeURIComponent(alertId)}/ack`, { method: 'POST' });
  }

  async watchlist(): Promise<{ items: unknown[] }> {
    return this.request<{ items: unknown[] }>('/api/watchlist');
  }

  async addWatchlist(ticker: string, listType: string): Promise<{ item: unknown }> {
    return this.request<{ item: unknown }>('/api/watchlist', {
      method: 'POST',
      bodyObject: { ticker, listType }
    });
  }

  async portfolio(): Promise<{ items: unknown[] }> {
    return this.request<{ items: unknown[] }>('/api/portfolio');
  }

  async approveTicket(ticketId: string): Promise<{ approved: boolean }> {
    return this.request<{ approved: boolean }>(`/api/tickets/${encodeURIComponent(ticketId)}/approve`, { method: 'POST' });
  }

  async rejectTicket(ticketId: string, reason?: string): Promise<{ rejected: boolean }> {
    const bodyObject = reason === undefined ? {} : { reason };
    return this.request<{ rejected: boolean }>(`/api/tickets/${encodeURIComponent(ticketId)}/reject`, {
      method: 'POST',
      bodyObject
    });
  }
}

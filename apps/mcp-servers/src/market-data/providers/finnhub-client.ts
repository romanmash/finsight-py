import { createUpstreamError, withRetry, withTimeout } from '../../shared/errors.js';

export interface RequestPolicy {
  timeoutMs: number;
  maxAttempts: number;
  backoffMs: number;
}

export interface FinnhubClientOptions {
  baseUrl: string;
  apiKey?: string | undefined;
}

export interface FinnhubQuote {
  price: number;
  changePct: number;
  volume: number;
  high52w: number;
  low52w: number;
  marketCap: number;
}

export interface FinnhubCandle {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: number;
}

export interface FinnhubFundamentals {
  peRatio: number | null;
  eps: number | null;
  revenueGrowthYoy: number | null;
  debtToEquity: number | null;
  sector: string;
}

export interface FinnhubEarnings {
  nextDate: string | null;
  estimateEps: number | null;
  prevEps: number | null;
  surprisePctLast: number | null;
}

export interface FinnhubAnalystRatings {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  period: string;
}

export interface FinnhubPriceTargets {
  avgTarget: number;
  highTarget: number;
  lowTarget: number;
  analystCount: number;
}

export class FinnhubClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string | undefined;

  constructor(options: FinnhubClientOptions) {
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
  }

  private async request<T>(path: string, params: Record<string, string>, policy: RequestPolicy): Promise<T> {
    const url = new URL(path, this.baseUrl);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    if (this.apiKey) {
      url.searchParams.set('token', this.apiKey);
    }

    const execute = async (): Promise<T> => {
      const response = await withTimeout(
        async () => await fetch(url.toString()),
        policy.timeoutMs,
        `Finnhub request timed out: ${path}`
      );

      if (!response.ok) {
        throw createUpstreamError(`Finnhub request failed (${response.status})`, { path, status: response.status });
      }

      return await response.json() as T;
    };

    return await withRetry(execute, policy.maxAttempts, policy.backoffMs);
  }

  async getQuote(ticker: string, policy: RequestPolicy): Promise<FinnhubQuote> {
    const payload = await this.request<Record<string, number>>('/quote', { symbol: ticker }, policy);

    return {
      price: payload.c ?? 0,
      changePct: payload.dp ?? 0,
      volume: payload.v ?? 0,
      high52w: payload.h ?? 0,
      low52w: payload.l ?? 0,
      marketCap: payload.pc ?? 0
    };
  }

  async getOhlcv(ticker: string, range: { from: number; to: number; resolution: string }, policy: RequestPolicy): Promise<FinnhubCandle[]> {
    const payload = await this.request<{ o?: number[]; h?: number[]; l?: number[]; c?: number[]; v?: number[]; t?: number[] }>(
      '/stock/candle',
      {
        symbol: ticker,
        from: String(range.from),
        to: String(range.to),
        resolution: range.resolution
      },
      policy
    );

    const length = payload.t?.length ?? 0;
    const candles: FinnhubCandle[] = [];

    for (let index = 0; index < length; index += 1) {
      candles.push({
        o: payload.o?.[index] ?? 0,
        h: payload.h?.[index] ?? 0,
        l: payload.l?.[index] ?? 0,
        c: payload.c?.[index] ?? 0,
        v: payload.v?.[index] ?? 0,
        t: payload.t?.[index] ?? 0
      });
    }

    return candles;
  }

  async getFundamentals(ticker: string, policy: RequestPolicy): Promise<FinnhubFundamentals> {
    const payload = await this.request<{ metric?: Record<string, number>; finnhubIndustry?: string }>('/stock/metric', { symbol: ticker, metric: 'all' }, policy);

    return {
      peRatio: payload.metric?.peTTM ?? null,
      eps: payload.metric?.epsTTM ?? null,
      revenueGrowthYoy: payload.metric?.revenueGrowthTTMYoy ?? null,
      debtToEquity: payload.metric?.totalDebtToEquityQuarterly ?? null,
      sector: payload.finnhubIndustry ?? 'Unknown'
    };
  }

  async getEarnings(ticker: string, policy: RequestPolicy): Promise<FinnhubEarnings> {
    const payload = await this.request<Array<Record<string, string | number | null>>>('/stock/earnings', { symbol: ticker }, policy);
    const latest = payload[0] ?? {};

    return {
      nextDate: typeof latest.period === 'string' ? latest.period : null,
      estimateEps: typeof latest.estimate === 'number' ? latest.estimate : null,
      prevEps: typeof latest.actual === 'number' ? latest.actual : null,
      surprisePctLast: typeof latest.surprisePercent === 'number' ? latest.surprisePercent : null
    };
  }

  async getAnalystRatings(ticker: string, policy: RequestPolicy): Promise<FinnhubAnalystRatings> {
    const payload = await this.request<Array<Record<string, string | number>>>('/stock/recommendation', { symbol: ticker }, policy);
    const latest = payload[0] ?? {};

    return {
      strongBuy: typeof latest.strongBuy === 'number' ? latest.strongBuy : 0,
      buy: typeof latest.buy === 'number' ? latest.buy : 0,
      hold: typeof latest.hold === 'number' ? latest.hold : 0,
      sell: typeof latest.sell === 'number' ? latest.sell : 0,
      strongSell: typeof latest.strongSell === 'number' ? latest.strongSell : 0,
      period: typeof latest.period === 'string' ? latest.period : 'n/a'
    };
  }

  async getPriceTargets(ticker: string, policy: RequestPolicy): Promise<FinnhubPriceTargets> {
    const payload = await this.request<Record<string, number>>('/stock/price-target', { symbol: ticker }, policy);

    return {
      avgTarget: payload.targetMean ?? 0,
      highTarget: payload.targetHigh ?? 0,
      lowTarget: payload.targetLow ?? 0,
      analystCount: payload.lastUpdated ? 1 : 0
    };
  }
}


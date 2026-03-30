import { createUpstreamError, withRetry, withTimeout } from '../../shared/errors.js';

import type { RequestPolicy } from './finnhub-client.js';

export interface FmpClientOptions {
  baseUrl: string;
  apiKey?: string | undefined;
}

export interface FmpQuote {
  price: number;
  changePct: number;
  volume: number;
  high52w: number;
  low52w: number;
  marketCap: number;
}

export interface FmpCandle {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: number;
}

export interface FmpFundamentals {
  peRatio: number | null;
  eps: number | null;
  revenueGrowthYoy: number | null;
  debtToEquity: number | null;
  sector: string;
}

export interface FmpEarnings {
  nextDate: string | null;
  estimateEps: number | null;
  prevEps: number | null;
  surprisePctLast: number | null;
}

export interface FmpRatings {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  period: string;
}

export interface FmpPriceTargets {
  avgTarget: number;
  highTarget: number;
  lowTarget: number;
  analystCount: number;
}

export class FmpClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string | undefined;

  constructor(options: FmpClientOptions) {
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey;
  }

  private async request<T>(path: string, params: Record<string, string>, policy: RequestPolicy): Promise<T> {
    const url = new URL(path, this.baseUrl);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    if (this.apiKey) {
      url.searchParams.set('apikey', this.apiKey);
    }

    const execute = async (): Promise<T> => {
      const response = await withTimeout(
        async () => await fetch(url.toString()),
        policy.timeoutMs,
        `FMP request timed out: ${path}`
      );

      if (!response.ok) {
        throw createUpstreamError(`FMP request failed (${response.status})`, { path, status: response.status });
      }

      return await response.json() as T;
    };

    return await withRetry(execute, policy.maxAttempts, policy.backoffMs);
  }

  async getQuote(ticker: string, policy: RequestPolicy): Promise<FmpQuote> {
    const payload = await this.request<Array<Record<string, number>>>(`/quote/${ticker}`, {}, policy);
    const first = payload[0] ?? {};

    return {
      price: first.price ?? 0,
      changePct: first.changesPercentage ?? 0,
      volume: first.volume ?? 0,
      high52w: first.yearHigh ?? 0,
      low52w: first.yearLow ?? 0,
      marketCap: first.marketCap ?? 0
    };
  }

  async getOhlcv(ticker: string, policy: RequestPolicy): Promise<FmpCandle[]> {
    const payload = await this.request<Array<Record<string, number | string>>>(`/historical-price-full/${ticker}`, {}, policy);
    const rows = Array.isArray(payload) ? payload : [];

    return rows.map((row) => ({
      o: typeof row.open === 'number' ? row.open : 0,
      h: typeof row.high === 'number' ? row.high : 0,
      l: typeof row.low === 'number' ? row.low : 0,
      c: typeof row.close === 'number' ? row.close : 0,
      v: typeof row.volume === 'number' ? row.volume : 0,
      t: typeof row.date === 'string' ? Math.floor(new Date(row.date).getTime() / 1000) : 0
    }));
  }

  async getFundamentals(ticker: string, policy: RequestPolicy): Promise<FmpFundamentals> {
    const profile = await this.request<Array<Record<string, string | number>>>(`/profile/${ticker}`, {}, policy);
    const ratios = await this.request<Array<Record<string, number>>>(`/ratios-ttm/${ticker}`, {}, policy);
    const growth = await this.request<Array<Record<string, number>>>(`/financial-growth/${ticker}`, {}, policy);

    const profileRow = profile[0] ?? {};
    const ratioRow = ratios[0] ?? {};
    const growthRow = growth[0] ?? {};

    return {
      peRatio: typeof ratioRow.peRatioTTM === 'number' ? ratioRow.peRatioTTM : null,
      eps: typeof ratioRow.epsTTM === 'number' ? ratioRow.epsTTM : null,
      revenueGrowthYoy: typeof growthRow.revenueGrowth === 'number' ? growthRow.revenueGrowth : null,
      debtToEquity: typeof ratioRow.debtEquityRatioTTM === 'number' ? ratioRow.debtEquityRatioTTM : null,
      sector: typeof profileRow.sector === 'string' ? profileRow.sector : 'Unknown'
    };
  }

  async getEarnings(ticker: string, policy: RequestPolicy): Promise<FmpEarnings> {
    const payload = await this.request<Array<Record<string, string | number>>>(`/historical/earning_calendar/${ticker}`, {}, policy);
    const latest = payload[0] ?? {};

    return {
      nextDate: typeof latest.date === 'string' ? latest.date : null,
      estimateEps: typeof latest.epsEstimated === 'number' ? latest.epsEstimated : null,
      prevEps: typeof latest.eps === 'number' ? latest.eps : null,
      surprisePctLast: typeof latest.eps === 'number' && typeof latest.epsEstimated === 'number' && latest.epsEstimated !== 0
        ? ((latest.eps - latest.epsEstimated) / latest.epsEstimated) * 100
        : null
    };
  }

  async getAnalystRatings(ticker: string, policy: RequestPolicy): Promise<FmpRatings> {
    const payload = await this.request<Array<Record<string, number | string>>>(`/rating/${ticker}`, {}, policy);
    const row = payload[0] ?? {};

    return {
      strongBuy: typeof row.ratingStrongBuy === 'number' ? row.ratingStrongBuy : 0,
      buy: typeof row.ratingBuy === 'number' ? row.ratingBuy : 0,
      hold: typeof row.ratingHold === 'number' ? row.ratingHold : 0,
      sell: typeof row.ratingSell === 'number' ? row.ratingSell : 0,
      strongSell: typeof row.ratingStrongSell === 'number' ? row.ratingStrongSell : 0,
      period: typeof row.date === 'string' ? row.date : 'n/a'
    };
  }

  async getPriceTargets(ticker: string, policy: RequestPolicy): Promise<FmpPriceTargets> {
    const payload = await this.request<Array<Record<string, number>>>(`/price-target/${ticker}`, {}, policy);
    const row = payload[0] ?? {};

    return {
      avgTarget: row.targetMean ?? 0,
      highTarget: row.targetHigh ?? 0,
      lowTarget: row.targetLow ?? 0,
      analystCount: row.numberAnalystOpinions ?? 0
    };
  }
}


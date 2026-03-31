import type { DiscoveryFinding } from '../../../types/collectors.js';

export function createQuotePayload(ticker: string, price: number, changePct: number, volume: number): {
  quotes: Array<{ ticker: string; price: number; changePct: number; volume: number }>;
} {
  return {
    quotes: [{ ticker, price, changePct, volume }]
  };
}

export function createDiscoveryPayload(results: DiscoveryFinding[]): { results: DiscoveryFinding[] } {
  return { results };
}

export function createOhlcvPayload(candles: Array<{ close: number; high: number; low: number; volume: number }>): {
  candles: Array<{ close: number; high: number; low: number; volume: number }>;
} {
  return { candles };
}
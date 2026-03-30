import { z } from 'zod';

export const tickerInputSchema = z.object({
  ticker: z.string().min(1)
}).strict();

export const quoteOutputSchema = z.object({
  ticker: z.string(),
  price: z.number(),
  change_pct: z.number(),
  volume: z.number(),
  market_cap: z.number(),
  high_52w: z.number(),
  low_52w: z.number()
}).strict();

export const ohlcvInputSchema = z.object({
  ticker: z.string().min(1),
  fromUnixSec: z.number().int().positive(),
  toUnixSec: z.number().int().positive(),
  resolution: z.string().min(1).default('D')
}).strict();

export const ohlcvOutputSchema = z.object({
  ticker: z.string(),
  candles: z.array(z.object({
    o: z.number(),
    h: z.number(),
    l: z.number(),
    c: z.number(),
    v: z.number(),
    t: z.number().int()
  }).strict())
}).strict();

export const fundamentalsOutputSchema = z.object({
  ticker: z.string(),
  pe_ratio: z.number().nullable(),
  eps: z.number().nullable(),
  revenue_growth_yoy: z.number().nullable(),
  debt_to_equity: z.number().nullable(),
  sector: z.string()
}).strict();

export const earningsOutputSchema = z.object({
  ticker: z.string(),
  next_date: z.string().nullable(),
  days_until: z.number().int().nullable(),
  estimate_eps: z.number().nullable(),
  prev_eps: z.number().nullable(),
  surprise_pct_last: z.number().nullable()
}).strict();

export const multipleQuotesInputSchema = z.object({
  tickers: z.array(z.string().min(1)).min(1).max(25)
}).strict();

export const multipleQuotesOutputSchema = z.object({
  quotes: z.record(quoteOutputSchema)
}).strict();

export const analystRatingsOutputSchema = z.object({
  ticker: z.string(),
  strong_buy: z.number().int().nonnegative(),
  buy: z.number().int().nonnegative(),
  hold: z.number().int().nonnegative(),
  sell: z.number().int().nonnegative(),
  strong_sell: z.number().int().nonnegative(),
  period: z.string()
}).strict();

export const priceTargetsOutputSchema = z.object({
  ticker: z.string(),
  avg_target: z.number(),
  high_target: z.number(),
  low_target: z.number(),
  analyst_count: z.number().int().nonnegative()
}).strict();

export type TickerInput = z.infer<typeof tickerInputSchema>;
export type OhlcvInput = z.infer<typeof ohlcvInputSchema>;
export type MultipleQuotesInput = z.infer<typeof multipleQuotesInputSchema>;

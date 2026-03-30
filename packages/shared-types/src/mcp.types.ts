/** Output from market-data MCP quote tool. */
export interface QuoteOutput {
  price: number;
  change_pct: number;
  volume: number;
  market_cap: number;
  high_52w: number;
  low_52w: number;
}

/** OHLCV timeseries payload from market-data MCP. */
export interface OhlcvOutput {
  candles: Array<{
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
    t: number;
  }>;
}

/** Company fundamentals payload from market-data MCP. */
export interface FundamentalsOutput {
  pe_ratio: number | null;
  eps: number | null;
  revenue_growth_yoy: number | null;
  debt_to_equity: number | null;
  sector: string;
}

/** Earnings calendar payload from market-data MCP. */
export interface EarningsOutput {
  next_date: string | null;
  days_until: number | null;
  estimate_eps: number | null;
  prev_eps: number | null;
  surprise_pct_last: number | null;
}

/** Aggregated analyst recommendation distribution. */
export interface AnalystRatingsOutput {
  strong_buy: number;
  buy: number;
  hold: number;
  sell: number;
  strong_sell: number;
  period: string;
}

/** Analyst price-target payload from external data providers. */
export interface PriceTargetsOutput {
  avg_target: number;
  high_target: number;
  low_target: number;
  analyst_count: number;
}

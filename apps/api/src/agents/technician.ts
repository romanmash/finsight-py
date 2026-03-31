import { getMcpToolRegistry } from '../mcp/index.js';
import { createRecoverableFailure, setCollectorActive, setCollectorError, setCollectorIdle } from './shared/collector-state.js';
import type { TechnicalCollectionOutput } from '../types/collectors.js';
import { technicalCollectionOutputSchema } from '../types/collectors.js';

interface Candle {
  close: number;
  high: number;
  low: number;
  volume: number;
}

interface ToolInvoker {
  invoke: (input: unknown) => Promise<{ output?: unknown; error?: { message: string } }>;
}

interface TechnicianDependencies {
  getTool: (name: string) => ToolInvoker | null;
  setActiveState: () => Promise<void>;
  setIdleState: (summary: string) => Promise<void>;
  setErrorState: (message: string) => Promise<void>;
}

function defaultDependencies(): TechnicianDependencies {
  const registry = getMcpToolRegistry();
  return {
    getTool: (name: string) => (registry.all[name] as ToolInvoker | undefined) ?? null,
    setActiveState: () => setCollectorActive('technician', 'technical-collection'),
    setIdleState: (summary: string) => setCollectorIdle('technician', summary),
    setErrorState: (message: string) => setCollectorError('technician', message)
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toCandle(value: unknown): Candle | null {
  const record = asRecord(value);
  if (record === null) {
    return null;
  }

  const close = typeof record.close === 'number' ? record.close : null;
  const high = typeof record.high === 'number' ? record.high : null;
  const low = typeof record.low === 'number' ? record.low : null;
  const volume = typeof record.volume === 'number' ? record.volume : null;

  if (close === null || high === null || low === null || volume === null) {
    return null;
  }

  return { close, high, low, volume };
}

function calculateRsi(values: number[], period = 14): number | null {
  if (values.length <= period) {
    return null;
  }

  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    const prev = values[i - 1];
    const current = values[i];
    if (prev === undefined || current === undefined) {
      continue;
    }

    const delta = current - prev;
    if (delta >= 0) {
      gains += delta;
    } else {
      losses += Math.abs(delta);
    }
  }

  if (losses === 0) {
    return 100;
  }

  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function calculateTrend(closes: number[]): TechnicalCollectionOutput['trend'] {
  if (closes.length < 2) {
    return 'neutral';
  }

  const first = closes[0] ?? 0;
  const last = closes[closes.length - 1] ?? 0;
  const change = ((last - first) / (first || 1)) * 100;

  if (change > 3) {
    return 'bullish';
  }

  if (change < -3) {
    return 'bearish';
  }

  return 'neutral';
}

function calculateConfidence(limitations: string[]): number {
  if (limitations.length === 0) {
    return 0.9;
  }

  if (limitations.length === 1) {
    return 0.65;
  }

  return 0.45;
}

export async function runTechnician(
  input: { ticker: string; periodWeeks: number },
  deps: TechnicianDependencies = defaultDependencies()
): Promise<TechnicalCollectionOutput> {
  await deps.setActiveState();

  try {
    const ticker = input.ticker.toUpperCase();
    const periodWeeks = Math.max(1, Math.floor(input.periodWeeks));
    const ohlcvTool = deps.getTool('get_ohlcv');
    if (ohlcvTool === null) {
      throw createRecoverableFailure('UPSTREAM_UNAVAILABLE', 'OHLCV tool is unavailable');
    }

    const result = await ohlcvTool.invoke({ ticker, days: periodWeeks * 7 });
    if (result.error !== undefined) {
      throw createRecoverableFailure('UPSTREAM_UNAVAILABLE', 'OHLCV request failed', { message: result.error.message });
    }

    const payload = asRecord(result.output);
    const candlesRaw = Array.isArray(payload?.candles) ? payload.candles : [];
    const candles = candlesRaw.map(toCandle).filter((value): value is Candle => value !== null);

    const closes = candles.map((candle) => candle.close);
    const highs = candles.map((candle) => candle.high);
    const lows = candles.map((candle) => candle.low);
    const volumes = candles.map((candle) => candle.volume);

    const limitations: string[] = [];

    const rsi = calculateRsi(closes);
    if (rsi === null) limitations.push('insufficient_history_rsi');

    const stochastic = highs.length >= 14
      ? ((): number => {
          const recentHigh = Math.max(...highs.slice(-14));
          const recentLow = Math.min(...lows.slice(-14));
          const lastClose = closes[closes.length - 1] ?? 0;
          const denominator = recentHigh - recentLow;
          return denominator === 0 ? 50 : ((lastClose - recentLow) / denominator) * 100;
        })()
      : null;
    if (stochastic === null) limitations.push('insufficient_history_stochastic');

    const macdHistogram = closes.length >= 26 ? average(closes.slice(-12)) - average(closes.slice(-26)) : null;
    if (macdHistogram === null) limitations.push('insufficient_history_macd');

    const volatility = closes.length > 1 ? standardDeviation(closes.slice(-Math.min(20, closes.length))) : null;
    if (volatility === null) limitations.push('insufficient_history_volatility');

    const averageVolume = volumes.length > 0 ? average(volumes) : null;
    if (averageVolume === null) limitations.push('missing_volume_data');

    const output: TechnicalCollectionOutput = {
      ticker,
      periodWeeks,
      trend: calculateTrend(closes),
      levels: {
        support: lows.length > 0 ? Math.min(...lows.slice(-Math.min(10, lows.length))) : 0,
        resistance: highs.length > 0 ? Math.max(...highs.slice(-Math.min(10, highs.length))) : 0
      },
      patterns: [],
      indicators: {
        rsi: rsi ?? undefined,
        stochastic: stochastic ?? undefined,
        macdHistogram: macdHistogram ?? undefined,
        volatility: volatility ?? undefined,
        averageVolume: averageVolume ?? undefined
      },
      confidence: calculateConfidence(limitations),
      limitations,
      summary: limitations.length === 0 ? 'technical indicators collected successfully' : 'technical output degraded due to partial history'
    };

    const validated = technicalCollectionOutputSchema.safeParse(output);
    if (!validated.success) {
      throw createRecoverableFailure('MALFORMED_OUTPUT', 'technician output failed validation', {
        issue: validated.error.issues[0]?.message
      });
    }

    const normalized: TechnicalCollectionOutput = {
      ticker: validated.data.ticker,
      periodWeeks: validated.data.periodWeeks,
      trend: validated.data.trend,
      levels: validated.data.levels,
      patterns: validated.data.patterns,
      indicators: {
        rsi: validated.data.indicators.rsi,
        stochastic: validated.data.indicators.stochastic,
        macdHistogram: validated.data.indicators.macdHistogram,
        volatility: validated.data.indicators.volatility,
        averageVolume: validated.data.indicators.averageVolume
      },
      confidence: validated.data.confidence,
      limitations: validated.data.limitations,
      summary: validated.data.summary
    };

    await deps.setIdleState(`ticker=${ticker} limitations=${String(limitations.length)}`);
    return normalized;
  } catch (error) {
    await deps.setErrorState((error as Error).message);
    if (typeof error === 'object' && error !== null && 'recoverable' in error) {
      throw error;
    }

    throw createRecoverableFailure('UPSTREAM_UNAVAILABLE', 'technician run failed', {
      errorMessage: (error as Error).message
    });
  }
}
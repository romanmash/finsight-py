import { COMPARISON_MODE_REQUIRED_TICKER_COUNT } from '../../types/reasoning.js';

const VALID_REASONING_MODES = new Set(['standard', 'devil_advocate', 'comparison']);
const VALID_SCREENER_TRIGGERS = new Set(['scheduled', 'manual']);

export function assertReasoningMode(mode: string): void {
  if (!VALID_REASONING_MODES.has(mode)) {
    throw new Error(`Unsupported reasoning mode: ${mode}`);
  }
}

export function assertComparisonCardinality(tickers: string[]): void {
  if (tickers.length !== COMPARISON_MODE_REQUIRED_TICKER_COUNT) {
    throw new Error(`Comparison requires exactly ${String(COMPARISON_MODE_REQUIRED_TICKER_COUNT)} tickers`);
  }
}

export function assertTechnicalConfidenceRange(confidence: number): void {
  if (confidence < 0 || confidence > 1) {
    throw new Error('Technical confidence must be within [0, 1]');
  }
}

export function assertScreenerTrigger(triggeredBy: string): void {
  if (!VALID_SCREENER_TRIGGERS.has(triggeredBy)) {
    throw new Error(`Invalid screener trigger provenance: ${triggeredBy}`);
  }
}

export function assertAlertContextMinimumFields(value: Record<string, unknown>): void {
  const required = ['instrument', 'signalType', 'triggerValue', 'thresholdValueOrEvent', 'snapshotTimestamp', 'evidenceSummary'];
  for (const key of required) {
    if (value[key] === undefined || value[key] === null) {
      throw new Error(`Missing alert context field: ${key}`);
    }
  }
}

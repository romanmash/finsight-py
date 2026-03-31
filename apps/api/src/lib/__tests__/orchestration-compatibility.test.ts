import { describe, expect, it } from 'vitest';

import {
  assertAlertContextMinimumFields,
  assertComparisonCardinality,
  assertReasoningMode,
  assertScreenerTrigger,
  assertTechnicalConfidenceRange
} from '../../agents/shared/orchestration-compatibility.js';

describe('orchestration compatibility guards', () => {
  it('accepts valid compatibility values', () => {
    expect(() => assertReasoningMode('standard')).not.toThrow();
    expect(() => assertComparisonCardinality(['NVDA', 'AMD'])).not.toThrow();
    expect(() => assertTechnicalConfidenceRange(0.5)).not.toThrow();
    expect(() => assertScreenerTrigger('manual')).not.toThrow();
    expect(() =>
      assertAlertContextMinimumFields({
        instrument: 'NVDA',
        signalType: 'price_spike',
        triggerValue: 1,
        thresholdValueOrEvent: 'breakout',
        snapshotTimestamp: new Date().toISOString(),
        evidenceSummary: 'evidence'
      })
    ).not.toThrow();
  });

  it('rejects invalid compatibility values', () => {
    expect(() => assertReasoningMode('unknown')).toThrow();
    expect(() => assertComparisonCardinality(['NVDA'])).toThrow();
    expect(() => assertTechnicalConfidenceRange(2)).toThrow();
    expect(() => assertScreenerTrigger('other')).toThrow();
  });
});

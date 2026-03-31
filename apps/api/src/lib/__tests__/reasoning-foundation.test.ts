import { describe, expect, it } from 'vitest';

import {
  assertTechnicalConfidenceRange,
  validateDiscoveryFindings,
  validateTechnicalCollectorOutput
} from '../../agents/shared/collector-contracts.js';
import { countSentences, splitIntoTelegramChunks } from '../../agents/shared/reasoning-validation.js';
import type { TechnicalCollectionOutput } from '../../types/collectors.js';

describe('reasoning foundation helpers', () => {
  it('validates technical confidence range in [0,1]', () => {
    expect(assertTechnicalConfidenceRange(0.5)).toBe(0.5);
    expect(() => assertTechnicalConfidenceRange(1.5)).toThrow(/range \[0,1\]/);
  });

  it('rejects discovery payloads using topHeadline', () => {
    expect(() =>
      validateDiscoveryFindings([
        {
          ticker: 'NVDA',
          sector: 'AI',
          reason: 'reason',
          signalScore: 9,
          topHeadline: 'invalid'
        } as unknown as never
      ])
    ).toThrow(/supportingHeadline/);
  });

  it('keeps chunk order for oversized telegram messages', () => {
    const text = 'a'.repeat(8200);
    const chunks = splitIntoTelegramChunks(text, 4096);

    expect(chunks).toHaveLength(3);
    expect(chunks.join('')).toBe(text);
  });

  it('counts sentences deterministically', () => {
    expect(countSentences('One. Two. Three.')).toBe(3);
    expect(countSentences('One only.')).toBe(1);
  });

  it('passes through validated technical payload', () => {
    const payload: TechnicalCollectionOutput = {
      ticker: 'NVDA',
      periodWeeks: 3,
      trend: 'bullish',
      levels: { support: 100, resistance: 140 },
      patterns: [],
      indicators: {
        rsi: 50,
        stochastic: undefined,
        macdHistogram: undefined,
        volatility: undefined,
        averageVolume: undefined
      },
      confidence: 0.75,
      limitations: [],
      summary: 'ok'
    };

    expect(validateTechnicalCollectorOutput(payload).confidence).toBe(0.75);
  });
});

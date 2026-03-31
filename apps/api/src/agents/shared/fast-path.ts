import type { FastPathResolution } from '../../types/orchestration.js';

interface FastPathInput {
  missionType: string;
  ticker: string | null;
  thesisFreshnessHours: number;
  now: Date;
  candidate: {
    id: string;
    content: string;
    updatedAt: Date;
    confidence: 'low' | 'medium' | 'high';
  } | null;
}

function isFresh(updatedAt: Date, now: Date, freshnessHours: number): boolean {
  const thresholdMs = freshnessHours * 60 * 60 * 1000;
  return now.getTime() - updatedAt.getTime() <= thresholdMs;
}

export function resolveFastPath(input: FastPathInput): FastPathResolution {
  if (input.missionType !== 'operator_query') {
    return { hit: false, reason: 'not_operator_query', entry: null };
  }

  if (input.ticker === null) {
    return { hit: false, reason: 'missing_ticker', entry: null };
  }

  if (input.candidate === null) {
    return { hit: false, reason: 'missing_entry', entry: null };
  }

  if (input.candidate.confidence !== 'high') {
    return { hit: false, reason: 'insufficient_confidence', entry: input.candidate };
  }

  if (!isFresh(input.candidate.updatedAt, input.now, input.thesisFreshnessHours)) {
    return { hit: false, reason: 'stale', entry: input.candidate };
  }

  return { hit: true, reason: 'eligible', entry: input.candidate };
}

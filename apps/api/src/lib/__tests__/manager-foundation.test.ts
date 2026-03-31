import { describe, expect, it } from 'vitest';

import { resolveFastPath } from '../../agents/shared/fast-path.js';
import { resolveMissionPipeline } from '../../agents/shared/mission-routing.js';
import { shouldReDispatch } from '../../agents/shared/re-dispatch.js';

describe('manager foundation helpers', () => {
  it('returns route table for comparison missions', () => {
    const pipeline = resolveMissionPipeline('comparison');
    expect(pipeline.steps[0]).toContain('researcher');
  });

  it('resolves fast-path eligibility deterministically', () => {
    const now = new Date('2026-03-31T00:00:00.000Z');
    const result = resolveFastPath({
      missionType: 'operator_query',
      ticker: 'NVDA',
      thesisFreshnessHours: 24,
      now,
      candidate: {
        id: 'kb-1',
        content: 'thesis',
        confidence: 'high',
        updatedAt: new Date('2026-03-30T12:00:00.000Z')
      }
    });

    expect(result.hit).toBe(true);
  });

  it('bounds redispatch to one cycle', () => {
    expect(shouldReDispatch({ enabled: true, confidence: 'low', alreadyReDispatched: false })).toBe(true);
    expect(shouldReDispatch({ enabled: true, confidence: 'low', alreadyReDispatched: true })).toBe(false);
  });
});

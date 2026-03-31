import { describe, expect, it } from 'vitest';

import { labelForMission } from '../formatter.js';

describe('formatter labels', () => {
  it('maps known mission label', () => {
    expect(labelForMission('operator_query')).toBe('📊 Analysis');
  });

  it('falls back for unknown mission label', () => {
    expect(labelForMission('unknown_mission')).toBe('📌 Mission Output');
  });
});

import { describe, expect, it } from 'vitest';

describe('queue and kb panel data contract', () => {
  it('keeps queue and kb metric shapes stable', (): void => {
    const queues = {
      depths: { screenerScan: 3, alertPipeline: 0 },
      pendingAlerts: 2,
      pendingTickets: 1
    };
    const kb = {
      totalEntries: 42,
      contradictionCount: 3,
      lastWriteAt: null,
      tickersTracked: 7
    };

    expect(queues.pendingAlerts).toBe(2);
    expect(queues.pendingTickets).toBe(1);
    expect(kb.totalEntries).toBe(42);
    expect(kb.contradictionCount).toBe(3);
  });
});

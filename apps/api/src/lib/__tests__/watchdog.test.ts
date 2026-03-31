import { describe, expect, it, vi } from 'vitest';

import { runWatchdog } from '../../agents/watchdog.js';

interface FakeWatchlistItem {
  id: string;
  ticker: string;
  userId: string;
}

function createPrismaStub(watchlist: FakeWatchlistItem[]): {
  watchlistItem: { findMany: ReturnType<typeof vi.fn> };
  priceSnapshot: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  alert: { create: ReturnType<typeof vi.fn> };
} {
  return {
    watchlistItem: {
      findMany: vi.fn().mockResolvedValue(watchlist)
    },
    priceSnapshot: {
      findFirst: vi.fn().mockResolvedValue({ volume: BigInt(1000) }),
      create: vi.fn().mockResolvedValue({ id: 'snap_1' })
    },
    alert: {
      create: vi.fn().mockResolvedValue({ id: 'alert_1' })
    }
  };
}

describe('runWatchdog', () => {
  it('writes snapshots and creates alert when threshold is exceeded', async () => {
    const prisma = createPrismaStub([{ id: 'w1', ticker: 'NVDA', userId: 'u1' }]);

    const tools = new Map<string, { invoke: (input: unknown) => Promise<{ output?: unknown; error?: { message: string } }> }>();
    tools.set('get_multiple_quotes', {
      invoke: async (): Promise<{ output: unknown }> => ({
        output: { quotes: [{ ticker: 'NVDA', price: 100, changePct: 5.1, volume: 2800 }] }
      })
    });
    tools.set('get_earnings', {
      invoke: async (): Promise<{ output: unknown }> => ({
        output: { nextEarningsDate: '2099-01-01T00:00:00.000Z' }
      })
    });
    tools.set('get_ticker_news', {
      invoke: async (): Promise<{ output: unknown }> => ({
        output: { items: [] }
      })
    });

    const queueAlert = vi.fn().mockResolvedValue(undefined);

    const result = await runWatchdog(
      { triggeredBy: 'manual' },
      {
        prisma: prisma as never,
        getNow: () => new Date('2026-03-31T10:00:00.000Z'),
        getTool: (name: string) => tools.get(name) ?? null,
        queueAlert,
        getRuntimeConfig: () => ({
          watchdog: {
            priceAlertThresholdPct: 2,
            volumeSpikeMultiplier: 2,
            earningsPreBriefDaysAhead: 3,
            newsLookbackMinutes: 30
          }
        }) as never,
        setActiveState: async (): Promise<void> => {},
        setIdleState: async (): Promise<void> => {},
        setErrorState: async (): Promise<void> => {}
      }
    );

    expect(prisma.priceSnapshot.create).toHaveBeenCalledTimes(1);
    expect(prisma.alert.create).toHaveBeenCalled();
    expect(queueAlert).toHaveBeenCalled();
    expect(result.snapshotsWritten).toBe(1);
    expect(result.alertsCreated).toBeGreaterThan(0);
  });

  it('returns zero signals when quote tool is unavailable', async () => {
    const prisma = createPrismaStub([{ id: 'w1', ticker: 'AAPL', userId: 'u1' }]);

    const result = await runWatchdog(
      { triggeredBy: 'scheduled' },
      {
        prisma: prisma as never,
        getNow: () => new Date('2026-03-31T10:00:00.000Z'),
        getTool: () => null,
        queueAlert: vi.fn().mockResolvedValue(undefined),
        getRuntimeConfig: () => ({
          watchdog: {
            priceAlertThresholdPct: 2,
            volumeSpikeMultiplier: 2,
            earningsPreBriefDaysAhead: 3,
            newsLookbackMinutes: 30
          }
        }) as never,
        setActiveState: async (): Promise<void> => {},
        setIdleState: async (): Promise<void> => {},
        setErrorState: async (): Promise<void> => {}
      }
    );

    expect(result.snapshotsWritten).toBe(0);
    expect(result.alertsCreated).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
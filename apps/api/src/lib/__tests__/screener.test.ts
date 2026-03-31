import { describe, expect, it, vi } from 'vitest';

import { runScreener } from '../../agents/screener.js';

describe('runScreener', () => {
  it('persists scheduled run with ranked results', async () => {
    const prisma = {
      screenerRun: {
        create: vi.fn().mockResolvedValue({ id: 'scr_1' })
      }
    };

    const tool = {
      invoke: async (): Promise<{ output: unknown }> => ({
        output: {
          results: [
            {
              ticker: 'MSFT',
              sector: 'technology',
              reason: 'momentum',
              signalScore: 0.92,
              supportingHeadline: 'Headline'
            }
          ]
        }
      })
    };

    const result = await runScreener(
      { triggeredBy: 'scheduled' },
      {
        prisma: prisma as never,
        getTool: (name: string) => (name === 'screen_market' ? tool : null),
        getRuntimeConfig: () => ({
          screener: {
            sectors: ['technology'],
            minimumSignalScore: 0.6,
            topResultsPerRun: 3
          }
        }) as never,
        setActiveState: async (): Promise<void> => {},
        setIdleState: async (): Promise<void> => {},
        setErrorState: async (): Promise<void> => {}
      }
    );

    expect(prisma.screenerRun.create).toHaveBeenCalledTimes(1);
    expect(result.triggeredBy).toBe('scheduled');
    expect(result.results.length).toBe(1);
  });

  it('rejects unknown trigger values', async () => {
    await expect(
      runScreener(
        { triggeredBy: 'admin-api' as never },
        {
          prisma: { screenerRun: { create: vi.fn() } } as never,
          getTool: () => null,
          getRuntimeConfig: () => ({ screener: { sectors: ['technology'], minimumSignalScore: 0.6, topResultsPerRun: 3 } }) as never,
          setActiveState: async (): Promise<void> => {},
          setIdleState: async (): Promise<void> => {},
          setErrorState: async (): Promise<void> => {}
        }
      )
    ).rejects.toMatchObject({ recoverable: true, code: 'VALIDATION_ERROR' });
  });
});
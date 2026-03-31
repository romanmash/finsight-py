import { describe, expect, it } from 'vitest';

import { runTechnician } from '../../agents/technician.js';

function createCandles(length: number): Array<{ close: number; high: number; low: number; volume: number }> {
  const candles: Array<{ close: number; high: number; low: number; volume: number }> = [];
  for (let index = 0; index < length; index += 1) {
    const close = 100 + index;
    candles.push({
      close,
      high: close + 1,
      low: close - 1,
      volume: 1000 + index * 10
    });
  }

  return candles;
}

describe('runTechnician', () => {
  it('computes indicator output inside valid ranges', async () => {
    const tool = {
      invoke: async (): Promise<{ output: unknown }> => ({
        output: {
          candles: createCandles(30)
        }
      })
    };

    const output = await runTechnician(
      { ticker: 'NVDA', periodWeeks: 3 },
      {
        getTool: (name: string) => (name === 'get_ohlcv' ? tool : null),
        setActiveState: async (): Promise<void> => {},
        setIdleState: async (): Promise<void> => {},
        setErrorState: async (): Promise<void> => {}
      }
    );

    expect(output.indicators.rsi).toBeGreaterThanOrEqual(0);
    expect(output.indicators.rsi).toBeLessThanOrEqual(100);
    expect(output.confidence).toBeGreaterThan(0);
  });

  it('returns limitations when history is insufficient', async () => {
    const tool = {
      invoke: async (): Promise<{ output: unknown }> => ({
        output: {
          candles: createCandles(5)
        }
      })
    };

    const output = await runTechnician(
      { ticker: 'MSFT', periodWeeks: 1 },
      {
        getTool: (name: string) => (name === 'get_ohlcv' ? tool : null),
        setActiveState: async (): Promise<void> => {},
        setIdleState: async (): Promise<void> => {},
        setErrorState: async (): Promise<void> => {}
      }
    );

    expect(output.limitations.length).toBeGreaterThan(0);
    expect(output.confidence).toBeLessThanOrEqual(0.65);
  });
});
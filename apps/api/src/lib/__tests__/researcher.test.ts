import { describe, expect, it } from 'vitest';

import { runResearcher } from '../../agents/researcher.js';

describe('runResearcher', () => {
  it('returns schema-conformant output with partial gaps', async () => {
    const toolMap = new Map<string, { invoke: (input: unknown) => Promise<{ output?: unknown; error?: { message: string } }> }>();
    toolMap.set('get_multiple_quotes', { invoke: async (): Promise<{ output: unknown }> => ({ output: { quotes: [{ ticker: 'NVDA' }] } }) });
    toolMap.set('get_company_fundamentals', { invoke: async (): Promise<{ error: { message: string } }> => ({ error: { message: 'upstream' } }) });
    toolMap.set('get_ticker_news', { invoke: async (): Promise<{ output: unknown }> => ({ output: { items: [] } }) });
    toolMap.set('rag_retrieve', { invoke: async (): Promise<{ output: unknown }> => ({ output: { items: [{ id: 'kb1' }] } }) });

    const output = await runResearcher(
      { ticker: 'NVDA', focusQuestions: ['recent news'], missionType: 'alert_investigation' },
      {
        getTool: (name: string) => toolMap.get(name) ?? null,
        getRuntimeConfig: () => ({ app: { collector: { researcherMaxToolSteps: 10 } } }) as never,
        setActiveState: async (): Promise<void> => {},
        setIdleState: async (): Promise<void> => {},
        setErrorState: async (): Promise<void> => {}
      }
    );

    expect(output.ticker).toBe('NVDA');
    expect(output.missionType).toBe('alert_investigation');
    expect(output.gaps).toContain('fundamentals_unavailable');
  });

  it('returns output even when only minimal data is available', async () => {
    const toolMap = new Map<string, { invoke: (input: unknown) => Promise<{ output?: unknown; error?: { message: string } }> }>();
    toolMap.set('get_multiple_quotes', { invoke: async (): Promise<{ output: unknown }> => ({ output: null }) });

    await expect(
      runResearcher(
        { ticker: 'AAPL', focusQuestions: [] },
        {
          getTool: (name: string) => toolMap.get(name) ?? null,
          getRuntimeConfig: () => ({ app: { collector: { researcherMaxToolSteps: 10 } } }) as never,
          setActiveState: async (): Promise<void> => {},
          setIdleState: async (): Promise<void> => {},
          setErrorState: async (): Promise<void> => {}
        }
      )
    ).resolves.toBeDefined();
  });

  it('rejects unsupported mission types as validation errors', async () => {
    await expect(
      runResearcher(
        { ticker: 'AAPL', focusQuestions: ['context'], missionType: 'unknown_mode' },
        {
          getTool: () => null,
          getRuntimeConfig: () => ({ app: { collector: { researcherMaxToolSteps: 10 } } }) as never,
          setActiveState: async (): Promise<void> => {},
          setIdleState: async (): Promise<void> => {},
          setErrorState: async (): Promise<void> => {}
        }
      )
    ).rejects.toMatchObject({ recoverable: true, code: 'VALIDATION_ERROR' });
  });
});

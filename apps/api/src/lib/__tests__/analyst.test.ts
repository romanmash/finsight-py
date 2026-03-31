import { describe, expect, it } from 'vitest';

import type { ResearchCollectionOutput } from '../../types/collectors.js';
import { buildTestSynthesizer, runAnalyst } from '../../agents/analyst.js';
import { buildAnalystInput } from './mocks/reasoning.js';

describe('runAnalyst', () => {
  it('returns valid output in standard mode', async () => {
    const input = buildAnalystInput();
    const output = await runAnalyst(input, { synthesize: buildTestSynthesizer() });

    expect(output.mode).toBe('standard');
    expect(output.thesisUpdate.length).toBeGreaterThan(0);
    expect(output.supportingEvidence.length).toBeGreaterThan(0);
  });

  it('supports devil advocate mode', async () => {
    const input = buildAnalystInput({ mode: 'devil_advocate' });
    const output = await runAnalyst(input, { synthesize: buildTestSynthesizer() });

    expect(output.mode).toBe('devil_advocate');
    expect(output.contradictions.length).toBeGreaterThan(0);
  });

  it('rejects devil advocate output with empty contradictions', async () => {
    const input = buildAnalystInput({ mode: 'devil_advocate' });

    await expect(
      runAnalyst(input, {
        synthesize: async () => ({
          ticker: 'NVDA',
          mode: 'devil_advocate',
          thesisUpdate: 'Counter-thesis',
          supportingEvidence: ['a'],
          riskFactors: ['b'],
          contradictions: [],
          confidence: 'medium',
          confidenceReason: 'ok'
        })
      })
    ).rejects.toThrow(/at least one contradiction/);
  });

  it('supports comparison mode with two instruments', async () => {
    const base = buildAnalystInput();
    const baseResearch = base.research as ResearchCollectionOutput;
    const peerResearch: ResearchCollectionOutput = {
      ...baseResearch,
      ticker: 'AMD'
    };

    const output = await runAnalyst(
      {
        ...base,
        mode: 'comparison',
        research: [baseResearch, peerResearch]
      },
      { synthesize: buildTestSynthesizer() }
    );

    expect(output.mode).toBe('comparison');
    expect(output.comparisonTable).toBeDefined();
  });

  it('rejects invalid comparison cardinality', async () => {
    const base = buildAnalystInput();
    const baseResearch = base.research as ResearchCollectionOutput;

    await expect(
      runAnalyst({
        ...base,
        mode: 'comparison',
        research: [baseResearch]
      })
    ).rejects.toThrow(/exactly 2 instruments/);
  });

  it('throws when synthesize dependency is not injected', async () => {
    const input = buildAnalystInput();

    await expect(runAnalyst(input)).rejects.toThrow(/synthesize provider is not wired/);
  });

  it('retries once on malformed output', async () => {
    const input = buildAnalystInput();
    let calls = 0;

    const output = await runAnalyst(input, {
      synthesize: async () => {
        calls += 1;
        if (calls === 1) {
          return { invalid: true };
        }

        return {
          ticker: 'NVDA',
          mode: 'standard',
          thesisUpdate: 'valid thesis',
          supportingEvidence: ['a'],
          riskFactors: ['b'],
          contradictions: [],
          confidence: 'high',
          confidenceReason: 'ok'
        };
      }
    });

    expect(calls).toBe(2);
    expect(output.thesisUpdate).toBe('valid thesis');
  });
});

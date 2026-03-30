import { beforeEach, describe, expect, it, vi } from 'vitest';

import { computeCostUsd } from '../pricing.js';

const mockConfig = {
  pricing: {
    providers: {
      anthropic: {
        'claude-sonnet-4-20250514': {
          inputPer1kTokens: 0.003,
          outputPer1kTokens: 0.015
        }
      },
      openai: {
        'gpt-4o': {
          inputPer1kTokens: 0.0025,
          outputPer1kTokens: 0.01
        }
      },
      azure: {},
      lmstudio: {
        '*': {
          inputPer1kTokens: 0,
          outputPer1kTokens: 0
        }
      }
    }
  }
};

vi.mock('../config.js', (): { getConfig: () => typeof mockConfig } => ({
  getConfig: () => mockConfig
}));

describe('computeCostUsd', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 0 for lmstudio provider', () => {
    expect(computeCostUsd('lmstudio', 'any-model', 5000, 3000)).toBe(0);
  });

  it('correctly calculates anthropic/claude-sonnet cost', () => {
    expect(computeCostUsd('anthropic', 'claude-sonnet-4-20250514', 1000, 500)).toBe(0.0105);
  });

  it('returns 0 and warns for unknown model', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(computeCostUsd('openai', 'unknown-model', 1000, 500)).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('returns 0 and warns for unknown provider', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(computeCostUsd('unknown-provider', 'gpt-4o', 1000, 500)).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('handles zero token counts', () => {
    expect(computeCostUsd('anthropic', 'claude-sonnet-4-20250514', 0, 0)).toBe(0);
  });
});

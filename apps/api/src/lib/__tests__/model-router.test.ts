import { describe, expect, it } from 'vitest';

import type { AgentsConfig } from '../../../../../config/types/index.js';
import { resolveProviderProfileFromPolicies, validateGenerationOverrides } from '../../providers/model-router.js';
import type { LocalProviderHealthState } from '../../types/agent-infrastructure.js';

function createAgentsConfig(): AgentsConfig {
  return {
    manager: {
      primary: { provider: 'anthropic', model: 'claude', temperature: 0.2, maxTokens: 2048 },
      fallback: { provider: 'azure', model: 'gpt-4o', temperature: 0.2, maxTokens: 2048 }
    },
    watchdog: { primary: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.1, maxTokens: 1024 } },
    screener: { primary: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.1, maxTokens: 1024 } },
    researcher: { primary: { provider: 'openai', model: 'gpt-4o', temperature: 0.2, maxTokens: 4096 } },
    analyst: {
      primary: { provider: 'anthropic', model: 'claude', temperature: 0.3, maxTokens: 4096 },
      fallback: { provider: 'azure', model: 'gpt-4o', temperature: 0.3, maxTokens: 4096 }
    },
    technician: { primary: { provider: 'openai', model: 'gpt-4o', temperature: 0.2, maxTokens: 2048 } },
    bookkeeper: { primary: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.1, maxTokens: 1024 } },
    reporter: {
      primary: { provider: 'lmstudio', model: 'llama-3.2', temperature: 0.5, maxTokens: 4096 },
      fallback: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.5, maxTokens: 4096 }
    },
    trader: { primary: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.1, maxTokens: 1024 } },
    confidence: { reDispatchOnLow: true }
  };
}

function availableHealth(): LocalProviderHealthState {
  return {
    available: true,
    checkedAt: new Date().toISOString(),
    staleAfterMs: 600000,
    modelCount: 1
  };
}

function unavailableHealth(): LocalProviderHealthState {
  return {
    available: false,
    checkedAt: new Date().toISOString(),
    staleAfterMs: 600000,
    reason: 'timeout'
  };
}

describe('model router', () => {
  it('selects primary provider when available', () => {
    const resolved = resolveProviderProfileFromPolicies('analyst', createAgentsConfig(), {
      healthSnapshot: availableHealth()
    });

    expect(resolved.provider).toBe('anthropic');
    expect(resolved.resolutionPath).toBe('primary');
  });

  it('selects deterministic fallback when primary unavailable', () => {
    const resolved = resolveProviderProfileFromPolicies('manager', createAgentsConfig(), {
      unavailableProviders: ['anthropic'],
      healthSnapshot: availableHealth()
    });

    expect(resolved.provider).toBe('azure');
    expect(resolved.resolutionPath).toBe('fallback');
  });

  it('returns no-provider-path error when fallback is missing', () => {
    expect(() =>
      resolveProviderProfileFromPolicies('watchdog', createAgentsConfig(), {
        unavailableProviders: ['openai'],
        healthSnapshot: availableHealth()
      })
    ).toThrow('No valid provider path');
  });

  it('applies bounded override values', () => {
    const resolved = resolveProviderProfileFromPolicies('analyst', createAgentsConfig(), {
      overrides: { temperature: 0.7, maxTokens: 2048 },
      healthSnapshot: availableHealth()
    });

    expect(resolved.effectiveTemperature).toBe(0.7);
    expect(resolved.effectiveMaxTokens).toBe(2048);
  });

  it('rejects out-of-bound overrides', () => {
    expect(() => validateGenerationOverrides({ temperature: 1.5 })).toThrow('temperature must be in range');
    expect(() => validateGenerationOverrides({ maxTokens: 9000 })).toThrow('maxTokens must be in range');
  });

  it('consumes local-provider health snapshot for routing decisions', () => {
    const resolved = resolveProviderProfileFromPolicies('reporter', createAgentsConfig(), {
      healthSnapshot: unavailableHealth()
    });

    expect(resolved.provider).toBe('openai');
    expect(resolved.resolutionPath).toBe('fallback');
  });
});

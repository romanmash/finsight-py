import type { AgentsConfig } from '../../../../config/types/index.js';
import { getConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import type {
  AgentName,
  GenerationOverrides,
  LocalProviderHealthState,
  ProviderName,
  ProviderResolutionPolicy,
  ResolvedProviderProfile
} from '../types/agent-infrastructure.js';
import { getLocalProviderHealthSnapshot } from './lmstudio-health.js';

const GLOBAL_TEMPERATURE_MIN = 0;
const GLOBAL_TEMPERATURE_MAX = 1;
const GLOBAL_MAX_TOKENS_MIN = 1;
const GLOBAL_MAX_TOKENS_MAX = 8192;

export class ProviderResolutionError extends Error {
  readonly code: 'UNKNOWN_AGENT' | 'NO_PROVIDER_PATH' | 'INVALID_OVERRIDE';

  constructor(code: ProviderResolutionError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

export interface ResolveProviderOptions {
  overrides?: GenerationOverrides;
  unavailableProviders?: ProviderName[];
  healthSnapshot?: LocalProviderHealthState;
}

// 'confidence' is a meta-config key in AgentsConfig, not a real agent.
// If new meta-keys are added to AgentsConfig, add them to this exclusion check.
function isAgentName(value: string): value is AgentName {
  return value !== 'confidence';
}

function getAgentPolicy(agentsConfig: AgentsConfig, agentName: AgentName): ProviderResolutionPolicy {
  const policy = agentsConfig[agentName];

  return {
    agentName,
    primary: policy.primary,
    fallback: policy.fallback
  };
}

function createAvailabilityMap(
  unavailableProviders: ProviderName[] | undefined,
  healthSnapshot: LocalProviderHealthState
): Record<ProviderName, boolean> {
  const unavailable = new Set<ProviderName>(unavailableProviders ?? []);

  return {
    anthropic: !unavailable.has('anthropic'),
    openai: !unavailable.has('openai'),
    azure: !unavailable.has('azure'),
    lmstudio: healthSnapshot.available && !unavailable.has('lmstudio')
  };
}

export function validateGenerationOverrides(overrides: GenerationOverrides | undefined): GenerationOverrides {
  if (overrides === undefined) {
    return {};
  }

  if (overrides.temperature !== undefined) {
    if (overrides.temperature < GLOBAL_TEMPERATURE_MIN || overrides.temperature > GLOBAL_TEMPERATURE_MAX) {
      throw new ProviderResolutionError(
        'INVALID_OVERRIDE',
        `temperature must be in range ${String(GLOBAL_TEMPERATURE_MIN)}-${String(GLOBAL_TEMPERATURE_MAX)}.`
      );
    }
  }

  if (overrides.maxTokens !== undefined) {
    if (overrides.maxTokens < GLOBAL_MAX_TOKENS_MIN || overrides.maxTokens > GLOBAL_MAX_TOKENS_MAX) {
      throw new ProviderResolutionError(
        'INVALID_OVERRIDE',
        `maxTokens must be in range ${String(GLOBAL_MAX_TOKENS_MIN)}-${String(GLOBAL_MAX_TOKENS_MAX)}.`
      );
    }
  }

  return overrides;
}

export function resolveProviderProfileFromPolicies(
  agentName: AgentName,
  agentsConfig: AgentsConfig,
  options?: ResolveProviderOptions
): ResolvedProviderProfile {
  const policy = getAgentPolicy(agentsConfig, agentName);
  const validatedOverrides = validateGenerationOverrides(options?.overrides);

  const healthSnapshot = options?.healthSnapshot ?? getLocalProviderHealthSnapshot();
  const availability = createAvailabilityMap(options?.unavailableProviders, healthSnapshot);

  const primary = policy.primary;
  if (availability[primary.provider]) {
    const primaryProfile: ResolvedProviderProfile = {
      provider: primary.provider,
      model: primary.model,
      effectiveTemperature: validatedOverrides.temperature ?? primary.temperature,
      effectiveMaxTokens: validatedOverrides.maxTokens ?? primary.maxTokens,
      resolutionPath: 'primary'
    };

    logger.info(
      {
        agentName,
        provider: primaryProfile.provider,
        model: primaryProfile.model,
        resolutionPath: primaryProfile.resolutionPath
      },
      'Resolved provider via primary policy'
    );

    return primaryProfile;
  }

  const fallback = policy.fallback;
  if (fallback !== undefined && availability[fallback.provider]) {
    const fallbackProfile: ResolvedProviderProfile = {
      provider: fallback.provider,
      model: fallback.model,
      effectiveTemperature: validatedOverrides.temperature ?? fallback.temperature,
      effectiveMaxTokens: validatedOverrides.maxTokens ?? fallback.maxTokens,
      resolutionPath: 'fallback'
    };

    logger.info(
      {
        agentName,
        provider: fallbackProfile.provider,
        model: fallbackProfile.model,
        resolutionPath: fallbackProfile.resolutionPath,
        primaryProvider: primary.provider
      },
      'Resolved provider via fallback policy'
    );

    return fallbackProfile;
  }

  logger.error(
    {
      agentName,
      primaryProvider: primary.provider,
      fallbackProvider: fallback?.provider,
      localProviderAvailable: healthSnapshot.available,
      localProviderReason: healthSnapshot.reason
    },
    'No valid provider resolution path found'
  );

  throw new ProviderResolutionError(
    'NO_PROVIDER_PATH',
    `No valid provider path for agent '${agentName}'. Primary '${primary.provider}' unavailable and fallback missing/unavailable.`
  );
}

export function resolveProviderProfile(agentNameInput: string, options?: ResolveProviderOptions): ResolvedProviderProfile {
  if (!isAgentName(agentNameInput)) {
    throw new ProviderResolutionError('UNKNOWN_AGENT', `Unknown agent '${agentNameInput}'.`);
  }

  return resolveProviderProfileFromPolicies(agentNameInput, getConfig().agents, options);
}


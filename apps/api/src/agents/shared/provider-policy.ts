import { resolveProviderProfile } from '../../providers/model-router.js';

const CONFIG_NOT_INITIALIZED_MESSAGE = 'Configuration has not been initialized';

/**
 * Resolve provider policy when config is available, but keep unit tests decoupled
 * from global config initialization.
 */
export function ensureProviderPolicyResolved(agentName: string): void {
  try {
    resolveProviderProfile(agentName);
  } catch (error) {
    if (error instanceof Error && error.message.includes(CONFIG_NOT_INITIALIZED_MESSAGE)) {
      return;
    }

    throw error;
  }
}

import type { ManagerInput } from '../../../types/orchestration.js';

export function buildManagerInput(overrides?: Partial<ManagerInput>): ManagerInput {
  return {
    userId: 'user-1',
    message: 'What is happening with NVDA?',
    ticker: 'NVDA',
    triggerType: 'user',
    ...overrides
  };
}

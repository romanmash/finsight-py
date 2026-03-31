import type { AnalystOutput, ContradictionSeverity, RunAnalystInput, RunBookkeeperInput, RunReporterInput, RunTraderInput } from '../../../types/reasoning.js';

export function buildAnalystInput(overrides?: Partial<RunAnalystInput>): RunAnalystInput {
  return {
    userId: 'user-1',
    missionId: 'mission-1',
    mode: 'standard',
    research: {
      ticker: 'NVDA',
      focusQuestions: ['trend'],
      missionType: 'operator_query',
      collectedFacts: [{ source: 'quotes' }],
      newsSummary: {},
      fundamentalsSummary: {},
      kbContext: [],
      confidence: 'high',
      gaps: []
    },
    ...overrides
  };
}

export function buildAnalystOutput(overrides?: Partial<AnalystOutput>): AnalystOutput {
  return {
    ticker: 'NVDA',
    mode: 'standard',
    thesisUpdate: 'NVDA thesis update',
    supportingEvidence: ['evidence'],
    riskFactors: ['risk'],
    contradictions: [],
    confidence: 'high',
    confidenceReason: 'confidence reason',
    ...overrides
  };
}

export function buildBookkeeperInput(overrides?: Partial<RunBookkeeperInput>): RunBookkeeperInput {
  return {
    userId: 'user-1',
    missionId: 'mission-1',
    missionType: 'operator_query',
    analystOutput: buildAnalystOutput(),
    ...overrides
  };
}

export function buildReporterInput(overrides?: Partial<RunReporterInput>): RunReporterInput {
  return {
    userId: 'user-1',
    missionId: 'mission-1',
    missionType: 'operator_query',
    payload: {
      thesisUpdate: 'NVDA thesis'
    },
    ...overrides
  };
}

export function buildTraderInput(overrides?: Partial<RunTraderInput>): RunTraderInput {
  return {
    userId: 'user-1',
    missionId: 'mission-1',
    ticker: 'NVDA',
    action: 'buy',
    quantity: 10,
    analystOutput: buildAnalystOutput(),
    ...overrides
  };
}

export function contradictionForText(content: string): ContradictionSeverity {
  if (content.toLowerCase().includes('contradiction')) {
    return 'high';
  }

  return 'none';
}

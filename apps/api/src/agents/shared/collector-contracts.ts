import type { DiscoveryFinding, TechnicalCollectionOutput } from '../../types/collectors.js';

export class CollectorContractError extends Error {
  readonly code: 'COLLECTOR_CONTRACT_MISMATCH';

  constructor(message: string) {
    super(message);
    this.code = 'COLLECTOR_CONTRACT_MISMATCH';
  }
}

export function assertTechnicalConfidenceRange(value: number): number {
  if (Number.isFinite(value) && value >= 0 && value <= 1) {
    return value;
  }

  throw new CollectorContractError('TechnicalCollectionOutput.confidence must be numeric in range [0,1].');
}

export function assertDiscoveryHeadlineField(discovery: DiscoveryFinding): string | undefined {
  const asRecord = discovery as unknown as Record<string, unknown>;
  if ('topHeadline' in asRecord) {
    throw new CollectorContractError('Use supportingHeadline instead of topHeadline.');
  }

  return discovery.supportingHeadline;
}

export function validateTechnicalCollectorOutput(payload: TechnicalCollectionOutput): TechnicalCollectionOutput {
  assertTechnicalConfidenceRange(payload.confidence);
  return payload;
}

export function validateDiscoveryFindings(findings: DiscoveryFinding[]): DiscoveryFinding[] {
  for (const finding of findings) {
    assertDiscoveryHeadlineField(finding);
  }

  return findings;
}

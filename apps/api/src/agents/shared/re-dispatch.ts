interface ReDispatchDecisionInput {
  enabled: boolean;
  confidence: 'low' | 'medium' | 'high';
  alreadyReDispatched: boolean;
}

export function shouldReDispatch(input: ReDispatchDecisionInput): boolean {
  if (!input.enabled) {
    return false;
  }

  if (input.alreadyReDispatched) {
    return false;
  }

  return input.confidence === 'low';
}

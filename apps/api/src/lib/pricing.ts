import { getConfig } from './config.js';

export function computeCostUsd(provider: string, model: string, tokensIn: number, tokensOut: number): number {
  if (provider === 'lmstudio') {
    return 0;
  }

  const providers = getConfig().pricing.providers as Record<string, Record<string, {
    inputPer1kTokens: number;
    outputPer1kTokens: number;
  }>>;

  const pricing = providers[provider];
  if (pricing === undefined) {
    console.warn(`Unknown provider '${provider}'. Returning zero cost.`);
    return 0;
  }

  const rates = pricing[model] ?? pricing['*'];
  if (rates === undefined) {
    console.warn(`Unknown model '${model}' for provider '${provider}'. Returning zero cost.`);
    return 0;
  }

  const total = (tokensIn / 1000) * rates.inputPer1kTokens + (tokensOut / 1000) * rates.outputPer1kTokens;
  return Number(total.toFixed(6));
}

import type { ResearchCollectionOutput } from '../types/collectors.js';
import type { AnalystOutput, RunAnalystInput } from '../types/reasoning.js';
import {
  analystOutputSchema,
  COMPARISON_MODE_REQUIRED_TICKER_COUNT,
  runAnalystInputSchema
} from '../types/reasoning.js';
import { buildPortfolioContextPrompt } from './portfolio-context.prompt.js';
import { ensureProviderPolicyResolved } from './shared/provider-policy.js';
import { validateWithSingleRetry } from './shared/reasoning-validation.js';

interface AnalystDependencies {
  synthesize: (input: RunAnalystInput) => Promise<unknown>;
}

function summarizeResearch(research: ResearchCollectionOutput): string {
  const factCount = research.collectedFacts.length;
  const gapCount = research.gaps.length;
  return `${research.ticker}: ${String(factCount)} facts, ${String(gapCount)} gaps`;
}

function defaultSynthesis(input: RunAnalystInput): AnalystOutput {
  const portfolioNote =
    input.portfolioContext !== undefined && input.portfolioContext.quantity > 0
      ? buildPortfolioContextPrompt(input.portfolioContext.quantity)
      : 'Portfolio context: none';

  if (input.mode === 'comparison') {
    const researchItems = Array.isArray(input.research) ? input.research : [input.research];
    if (researchItems.length !== COMPARISON_MODE_REQUIRED_TICKER_COUNT) {
      throw new Error(`comparison mode requires exactly ${String(COMPARISON_MODE_REQUIRED_TICKER_COUNT)} instruments`);
    }

    const tickers = researchItems.map((item) => item.ticker);

    return {
      ticker: tickers,
      mode: 'comparison',
      thesisUpdate: `Relative view across ${tickers.join(' vs ')} based on current collected evidence.`,
      supportingEvidence: researchItems.map((item) => summarizeResearch(item)),
      riskFactors: ['Model confidence depends on upstream data freshness.', portfolioNote],
      contradictions: [],
      confidence: researchItems.some((item) => item.confidence === 'low') ? 'medium' : 'high',
      confidenceReason: 'Comparison confidence is derived from source evidence completeness.',
      comparisonTable: Object.fromEntries(
        researchItems.map((item) => [
          item.ticker,
          {
            confidence: item.confidence,
            gaps: item.gaps
          }
        ])
      )
    };
  }

  const research = Array.isArray(input.research) ? input.research.at(0) : input.research;
  if (research === undefined) {
    throw new Error('Analyst requires at least one research item');
  }

  const modeLabel = input.mode === 'devil_advocate' ? 'counter-thesis' : 'thesis';

  return {
    ticker: research.ticker,
    mode: input.mode,
    thesisUpdate: `Generated ${modeLabel} for ${research.ticker} from collected evidence.`,
    supportingEvidence: [summarizeResearch(research), portfolioNote],
    riskFactors: ['Upstream data may be incomplete.', `Open data gaps: ${research.gaps.join(', ') || 'none'}`],
    contradictions: input.mode === 'devil_advocate' ? ['Contrarian path requested by operator.'] : [],
    confidence: research.confidence,
    confidenceReason: 'Confidence follows validated collector evidence quality.'
  };
}

export function buildTestSynthesizer(): AnalystDependencies['synthesize'] {
  return async (input: RunAnalystInput): Promise<AnalystOutput> => defaultSynthesis(input);
}

function defaultDependencies(): AnalystDependencies {
  return {
    synthesize: async (): Promise<AnalystOutput> => {
      throw new Error('Analyst synthesize provider is not wired. Inject synthesize dependency.');
    }
  };
}

export async function runAnalyst(input: RunAnalystInput, deps: AnalystDependencies = defaultDependencies()): Promise<AnalystOutput> {
  const parsedInput = runAnalystInputSchema.parse(input);
  ensureProviderPolicyResolved('analyst');

  if (parsedInput.mode === 'comparison') {
    const items = Array.isArray(parsedInput.research) ? parsedInput.research : [parsedInput.research];
    if (items.length !== COMPARISON_MODE_REQUIRED_TICKER_COUNT) {
      throw new Error(`comparison mode requires exactly ${String(COMPARISON_MODE_REQUIRED_TICKER_COUNT)} instruments`);
    }
  }

  const output = await validateWithSingleRetry(async () => deps.synthesize(parsedInput), analystOutputSchema);

  if (parsedInput.mode === 'comparison' && output.comparisonTable === undefined) {
    throw new Error('comparison mode output must include comparisonTable');
  }

  if (parsedInput.mode === 'devil_advocate' && output.contradictions.length === 0) {
    throw new Error('devil_advocate mode output must include at least one contradiction');
  }

  return output;
}

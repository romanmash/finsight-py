import { db } from '../lib/db.js';
import { getConfig } from '../lib/config.js';
import { ensureProviderPolicyResolved } from './shared/provider-policy.js';
import { getCurrentThesisContext, getPortfolioQuantity } from './shared/thesis-context.js';
import { countSentences } from './shared/reasoning-validation.js';
import type { RunTraderInput, TraderOutput } from '../types/reasoning.js';
import { runTraderInputSchema, traderOutputSchema } from '../types/reasoning.js';
import { TRADER_WARNING_TEXT } from './trader.prompt.js';

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

interface TraderDependencies {
  getCurrentThesis: (ticker: string) => Promise<{ content: string } | null>;
  getQuantity: (userId: string, ticker: string) => Promise<number>;
  buildRationale: (input: RunTraderInput, thesis: { content: string } | null) => Promise<string>;
  createTicket: (input: {
    parsed: RunTraderInput;
    rationale: string;
    warningText: string;
  }) => Promise<string>;
}

function defaultDependencies(): TraderDependencies {
  return {
    getCurrentThesis: async (ticker: string): Promise<{ content: string } | null> => {
      const thesis = await getCurrentThesisContext(ticker);
      if (thesis === null) {
        return null;
      }

      return { content: thesis.content };
    },
    getQuantity: async (userId: string, ticker: string): Promise<number> => getPortfolioQuantity(userId, ticker),
    buildRationale: async (input: RunTraderInput, thesis: { content: string } | null): Promise<string> => {
      const sentence1 = `Signal review indicates a ${input.action} setup for ${input.ticker}.`;
      const sentence2 = thesis !== null ? `Current thesis context: ${thesis.content}.` : 'No prior thesis context was found for this instrument.';
      const sentence3 = `Position size request is ${String(input.quantity)} and requires explicit approval.`;
      return `${sentence1} ${sentence2} ${sentence3}`;
    },
    createTicket: async ({ parsed, rationale, warningText }): Promise<string> => {
      const expiresAt = new Date(Date.now() + getConfig().trader.ticketExpiryHours * MILLISECONDS_PER_HOUR);
      const ticket = await db.tradeTicket.create({
        data: {
          userId: parsed.userId,
          ticker: parsed.ticker,
          action: parsed.action,
          quantity: parsed.quantity,
          rationale: `${rationale}\n\n${warningText}`,
          confidence: parsed.analystOutput.confidence,
          basedOnMissions: [parsed.missionId],
          status: 'pending_approval',
          expiresAt,
          missionId: parsed.missionId
        }
      });

      return ticket.id;
    }
  };
}

export async function runTrader(input: RunTraderInput, deps: TraderDependencies = defaultDependencies()): Promise<TraderOutput> {
  const parsed = runTraderInputSchema.parse(input);
  ensureProviderPolicyResolved('trader');

  if (parsed.action === 'sell') {
    const quantity = await deps.getQuantity(parsed.userId, parsed.ticker);
    if (quantity <= 0) {
      throw new Error('Cannot create sell ticket for non-held position');
    }
  }

  const thesis = await deps.getCurrentThesis(parsed.ticker);
  const rationale = await deps.buildRationale(parsed, thesis);

  if (countSentences(rationale) !== 3) {
    throw new Error('Trader rationale must contain exactly three sentences');
  }

  const ticketId = await deps.createTicket({
    parsed,
    rationale,
    warningText: TRADER_WARNING_TEXT
  });

  return traderOutputSchema.parse({
    ticketId,
    status: 'pending_approval',
    rationale,
    warningText: TRADER_WARNING_TEXT
  });
}

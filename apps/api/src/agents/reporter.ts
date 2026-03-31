import { db } from '../lib/db.js';
import { ensureProviderPolicyResolved } from './shared/provider-policy.js';
import type { ReporterOutput, RunReporterInput } from '../types/reasoning.js';
import { reporterOutputSchema, runReporterInputSchema, TELEGRAM_MESSAGE_MAX_LENGTH } from '../types/reasoning.js';
import { splitIntoTelegramChunks } from './shared/reasoning-validation.js';

interface ReporterDependencies {
  formatPrimary: (input: RunReporterInput) => Promise<string>;
  formatFallback: (input: RunReporterInput) => Promise<string>;
  sendTelegram: (userId: string, message: string) => Promise<void>;
  persistDailyBrief: (input: RunReporterInput, text: string) => Promise<string | null>;
}

const MISSION_LABELS: Record<string, string> = {
  operator_query: '📊 Analysis',
  alert_investigation: '🚨 Alert Investigation',
  comparison: '⚖️ Comparison',
  devil_advocate: '🧪 Devil\'s Advocate',
  pattern_request: '📈 Pattern',
  earnings_prebrief: '🗓️ Earnings Prebrief',
  trade_request: '🧾 Trade Ticket',
  daily_brief: '📰 Daily Brief'
};

function resolveLabel(missionType: string): string {
  return MISSION_LABELS[missionType] ?? '📌 Mission Output';
}

function estimateTokens(value: unknown): number {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return Math.max(1, Math.ceil(serialized.length / 4));
}

function defaultDependencies(): ReporterDependencies {
  return {
    formatPrimary: async (): Promise<string> => {
      throw new Error('Reporter formatter provider is not wired. Inject formatPrimary dependency.');
    },
    formatFallback: async (): Promise<string> => {
      throw new Error('Reporter fallback formatter is not wired. Inject formatFallback dependency.');
    },
    sendTelegram: async (): Promise<void> => {
      throw new Error('Telegram delivery is not wired. Inject sendTelegram dependency.');
    },
    persistDailyBrief: async (input: RunReporterInput, text: string): Promise<string | null> => {
      if (input.missionType !== 'daily_brief') {
        return null;
      }

      const date = new Date().toISOString().slice(0, 10);
      const upserted = await db.dailyBrief.upsert({
        where: {
          userId_date: {
            userId: input.userId,
            date
          }
        },
        update: {
          rawText: text,
          missionId: input.missionId,
          generatedAt: new Date()
        },
        create: {
          userId: input.userId,
          date,
          topSignals: [],
          thesisUpdates: [],
          upcomingEvents: [],
          screenerFinds: [],
          watchlistSummary: [],
          analystConsensus: [],
          rawText: text,
          missionId: input.missionId
        }
      });

      return upserted.id;
    }
  };
}

export async function runReporter(input: RunReporterInput, deps: ReporterDependencies = defaultDependencies()): Promise<ReporterOutput> {
  const parsed = runReporterInputSchema.parse(input);
  ensureProviderPolicyResolved('reporter');
  const label = resolveLabel(parsed.missionType);

  let formatted: string;
  try {
    formatted = await deps.formatPrimary(parsed);
  } catch {
    formatted = await deps.formatFallback(parsed);
  }

  const messageText = `${label}\n\n${formatted}`;
  const chunks = splitIntoTelegramChunks(messageText, TELEGRAM_MESSAGE_MAX_LENGTH);

  let failedChunkCount = 0;
  for (const chunk of chunks) {
    try {
      await deps.sendTelegram(parsed.userId, chunk);
    } catch {
      failedChunkCount += 1;
    }
  }

  const persistedDailyBriefId = await deps.persistDailyBrief(parsed, messageText);

  return reporterOutputSchema.parse({
    delivered: failedChunkCount === 0,
    messageCount: chunks.length,
    label,
    persistedDailyBriefId: persistedDailyBriefId ?? undefined,
    failedChunkCount,
    _usage: {
      tokensIn: estimateTokens(parsed.payload),
      tokensOut: estimateTokens(messageText),
      costUsd: 0
    }
  });
}

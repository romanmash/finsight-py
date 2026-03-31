import type { PrismaClient } from '@prisma/client';

import { db } from '../lib/db.js';
import { getConfig } from '../lib/config.js';
import { getMcpToolRegistry } from '../mcp/index.js';
import { createRecoverableFailure, setCollectorActive, setCollectorError, setCollectorIdle } from './shared/collector-state.js';
import type { WatchdogAlertType, WatchdogRunResult } from '../types/collectors.js';

interface ToolInvoker {
  invoke: (input: unknown) => Promise<{ output?: unknown; error?: { message: string } }>;
}

interface WatchdogDependencies {
  prisma: PrismaClient;
  getNow: () => Date;
  getTool: (name: string) => ToolInvoker | null;
  queueAlert: (name: string, payload: unknown) => Promise<unknown>;
  getRuntimeConfig: () => ReturnType<typeof getConfig>;
  setActiveState: () => Promise<void>;
  setIdleState: (summary: string) => Promise<void>;
  setErrorState: (message: string) => Promise<void>;
}

function defaultDependencies(): WatchdogDependencies {
  const registry = getMcpToolRegistry();

  return {
    prisma: db,
    getNow: () => new Date(),
    getTool: (name: string) => (registry.all[name] as ToolInvoker | undefined) ?? null,
    queueAlert: async (name: string, payload: unknown): Promise<unknown> => {
      const { alertPipelineQueue } = await import('../lib/queues.js');
      return alertPipelineQueue.add(name, payload);
    },
    getRuntimeConfig: () => getConfig(),
    setActiveState: () => setCollectorActive('watchdog', 'monitoring-cycle'),
    setIdleState: (summary: string) => setCollectorIdle('watchdog', summary),
    setErrorState: (message: string) => setCollectorError('watchdog', message)
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function severityForAlertType(alertType: WatchdogAlertType): 'low' | 'medium' | 'high' {
  if (alertType === 'price_spike' || alertType === 'pattern_signal') {
    return 'high';
  }

  if (alertType === 'volume_spike' || alertType === 'news_event') {
    return 'medium';
  }

  return 'low';
}

function daysUntil(targetIso: string, now: Date): number | null {
  const parsed = new Date(targetIso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return Math.ceil((parsed.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

async function invokeToolSafe(tool: ToolInvoker | null, input: unknown): Promise<Record<string, unknown> | null> {
  if (tool === null) {
    return null;
  }

  const result = await tool.invoke(input);
  if (result.error !== undefined) {
    return null;
  }

  return asRecord(result.output);
}

export async function runWatchdog(
  input: { triggeredBy?: 'scheduled' | 'manual' } = {},
  deps: WatchdogDependencies = defaultDependencies()
): Promise<WatchdogRunResult> {
  const config = deps.getRuntimeConfig();
  const now = deps.getNow();
  const warnings: string[] = [];

  await deps.setActiveState();

  try {
    const watchlistItems = await deps.prisma.watchlistItem.findMany({
      where: { active: true },
      select: { id: true, ticker: true, userId: true }
    });

    if (watchlistItems.length === 0) {
      const result: WatchdogRunResult = { snapshotsWritten: 0, alertsCreated: 0, alerts: [], warnings: [] };
      await deps.setIdleState('watchlist-empty');
      return result;
    }

    const quoteTool = deps.getTool('get_multiple_quotes');
    const quotePayload = await invokeToolSafe(quoteTool, {
      tickers: watchlistItems.map((item) => item.ticker)
    });

    if (quotePayload === null) {
      warnings.push('get_multiple_quotes unavailable; run completed with zero signals');
      const result: WatchdogRunResult = { snapshotsWritten: 0, alertsCreated: 0, alerts: [], warnings };
      await deps.setIdleState('quotes-unavailable');
      return result;
    }

    const quoteListRaw = Array.isArray(quotePayload.quotes) ? quotePayload.quotes : [];
    const quotesByTicker = new Map<string, Record<string, unknown>>();
    for (const entry of quoteListRaw) {
      const record = asRecord(entry);
      if (record === null) {
        continue;
      }

      const ticker = record.ticker;
      if (typeof ticker === 'string' && ticker.length > 0) {
        quotesByTicker.set(ticker.toUpperCase(), record);
      }
    }

    const createdAlerts: Array<{ ticker: string; alertType: WatchdogAlertType }> = [];
    let snapshotsWritten = 0;

    for (const item of watchlistItems) {
      const quote = quotesByTicker.get(item.ticker.toUpperCase());
      if (quote === undefined) {
        warnings.push(`missing quote for ${item.ticker}`);
        continue;
      }

      const price = toNumber(quote.price);
      const changePct = toNumber(quote.changePct) ?? 0;
      const volume = toNumber(quote.volume);
      if (price === null || volume === null) {
        warnings.push(`invalid quote shape for ${item.ticker}`);
        continue;
      }

      const previous = await deps.prisma.priceSnapshot.findFirst({
        where: { watchlistItemId: item.id },
        orderBy: { capturedAt: 'desc' }
      });

      await deps.prisma.priceSnapshot.create({
        data: {
          watchlistItemId: item.id,
          ticker: item.ticker,
          price,
          changePct,
          volume: BigInt(Math.max(0, Math.floor(volume))),
          capturedAt: now
        }
      });

      snapshotsWritten += 1;

      const alertCandidates: Array<{ alertType: WatchdogAlertType; message: string; context: Record<string, unknown> }> = [];

      if (Math.abs(changePct) >= config.watchdog.priceAlertThresholdPct) {
        alertCandidates.push({
          alertType: 'price_spike',
          message: `${item.ticker} moved ${changePct.toFixed(2)}%`,
          context: {
            instrument: item.ticker,
            signalType: 'price_spike',
            triggerValue: changePct,
            thresholdValueOrEvent: config.watchdog.priceAlertThresholdPct,
            snapshotTimestamp: now.toISOString(),
            evidenceSummary: 'price threshold exceeded'
          }
        });
      }

      if (previous !== null) {
        const previousVolume = Number(previous.volume);
        if (previousVolume > 0 && volume >= previousVolume * config.watchdog.volumeSpikeMultiplier) {
          alertCandidates.push({
            alertType: 'volume_spike',
            message: `${item.ticker} volume spike detected`,
            context: {
              instrument: item.ticker,
              signalType: 'volume_spike',
              triggerValue: volume,
              thresholdValueOrEvent: previousVolume * config.watchdog.volumeSpikeMultiplier,
              snapshotTimestamp: now.toISOString(),
              evidenceSummary: 'volume multiplier threshold exceeded'
            }
          });
        }
      }

      if (quote.patternSignal === true) {
        alertCandidates.push({
          alertType: 'pattern_signal',
          message: `${item.ticker} pattern signal detected`,
          context: {
            instrument: item.ticker,
            signalType: 'pattern_signal',
            triggerValue: 1,
            thresholdValueOrEvent: 'pattern_signal=true',
            snapshotTimestamp: now.toISOString(),
            evidenceSummary: 'pattern signal flag present'
          }
        });
      }

      const earningsTool = deps.getTool('get_earnings');
      const earningsPayload = await invokeToolSafe(earningsTool, { ticker: item.ticker });
      const earningsDate = typeof earningsPayload?.nextEarningsDate === 'string' ? earningsPayload.nextEarningsDate : null;
      if (earningsDate !== null) {
        const days = daysUntil(earningsDate, now);
        if (days !== null && days >= 0 && days <= config.watchdog.earningsPreBriefDaysAhead) {
          alertCandidates.push({
            alertType: 'earnings_approaching',
            message: `${item.ticker} earnings in ${String(days)} day(s)`,
            context: {
              instrument: item.ticker,
              signalType: 'earnings_approaching',
              triggerValue: days,
              thresholdValueOrEvent: config.watchdog.earningsPreBriefDaysAhead,
              snapshotTimestamp: now.toISOString(),
              evidenceSummary: 'earnings within configured window'
            }
          });
        }
      }

      if (alertCandidates.length > 0) {
        const newsTool = deps.getTool('get_ticker_news');
        const newsPayload = await invokeToolSafe(newsTool, {
          ticker: item.ticker,
          lookbackMinutes: config.watchdog.newsLookbackMinutes
        });
        const newsItems = Array.isArray(newsPayload?.items) ? newsPayload.items : [];
        if (newsItems.length > 0) {
          alertCandidates.push({
            alertType: 'news_event',
            message: `${item.ticker} recent news detected`,
            context: {
              instrument: item.ticker,
              signalType: 'news_event',
              triggerValue: newsItems.length,
              thresholdValueOrEvent: 'news_items>0',
              snapshotTimestamp: now.toISOString(),
              evidenceSummary: 'news items found for flagged instrument'
            }
          });
        }
      }

      for (const candidate of alertCandidates) {
        await deps.prisma.alert.create({
          data: {
            userId: item.userId,
            ticker: item.ticker,
            alertType: candidate.alertType,
            severity: severityForAlertType(candidate.alertType),
            message: candidate.message
          }
        });

        createdAlerts.push({ ticker: item.ticker, alertType: candidate.alertType });

        await deps.queueAlert('alert-investigation', {
          triggeredBy: input.triggeredBy ?? 'scheduled',
          ticker: item.ticker,
          alertType: candidate.alertType,
          context: candidate.context
        });
      }
    }

    const result: WatchdogRunResult = {
      snapshotsWritten,
      alertsCreated: createdAlerts.length,
      alerts: createdAlerts,
      warnings
    };

    await deps.setIdleState(`snapshots=${String(snapshotsWritten)} alerts=${String(createdAlerts.length)}`);
    return result;
  } catch (error) {
    await deps.setErrorState((error as Error).message);
    throw createRecoverableFailure('UPSTREAM_UNAVAILABLE', 'watchdog run failed', {
      errorMessage: (error as Error).message
    });
  }
}


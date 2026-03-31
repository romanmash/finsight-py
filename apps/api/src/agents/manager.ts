import { MissionType } from '@finsight/shared-types';

import { buildTestSynthesizer, runAnalyst } from './analyst.js';
import { runBookkeeper } from './bookkeeper.js';
import { runReporter } from './reporter.js';
import { runResearcher } from './researcher.js';
import { runTechnician } from './technician.js';
import { runTrader } from './trader.js';
import { getConfig } from '../lib/config.js';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import type { RunAnalystInput, TraderAction } from '../types/reasoning.js';
import { KB_EMBEDDING_VECTOR_LENGTH } from '../types/reasoning.js';
import type { ManagerInput, ManagerOutput, MissionTypeValue } from '../types/orchestration.js';
import { managerInputSchema, managerOutputSchema } from '../types/orchestration.js';
import { resolveFastPath } from './shared/fast-path.js';
import { completeMission, failMission, startMission, writeAgentRun } from './shared/mission-lifecycle.js';
import { resolveMissionPipeline } from './shared/mission-routing.js';
import { assertComparisonCardinality } from './shared/orchestration-compatibility.js';
import { shouldReDispatch } from './shared/re-dispatch.js';

interface ManagerDependencies {
  now: () => Date;
}

interface TradeParams {
  action: TraderAction;
  quantity: number;
}

interface UsageMetrics {
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

function defaultDependencies(): ManagerDependencies {
  return { now: () => new Date() };
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return { value };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function parseTickers(input: ManagerInput): string[] {
  if (input.tickers !== undefined && input.tickers.length > 0) {
    return input.tickers.map((ticker) => ticker.toUpperCase());
  }

  if (input.ticker !== undefined) {
    return [input.ticker.toUpperCase()];
  }

  return [];
}

function deriveMissionType(input: ManagerInput): MissionTypeValue {
  if (input.missionType !== undefined) {
    return input.missionType;
  }

  const text = input.message?.toLowerCase() ?? '';
  if (text.includes('/compare')) return MissionType.COMPARISON;
  if (text.includes('/devil')) return MissionType.DEVIL_ADVOCATE;
  if (text.includes('/pattern')) return MissionType.PATTERN_REQUEST;
  if (text.includes('/trade')) return MissionType.TRADE_REQUEST;
  if (input.triggerType === 'scheduled') {
    logger.warn('Scheduled trigger received without explicit missionType. Defaulting to daily_brief.');
    return MissionType.DAILY_BRIEF;
  }
  if (input.triggerType === 'alert') return MissionType.ALERT_INVESTIGATION;
  return MissionType.OPERATOR_QUERY;
}

function resolvePatternPeriodWeeks(context: Record<string, unknown>): number {
  const raw = context.periodWeeks;
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) {
    return raw;
  }

  return getConfig().app.patternDefaultPeriodWeeks;
}

function resolveTradeParams(context: Record<string, unknown>): TradeParams | null {
  const nested = asRecord(context.trade);
  const actionRaw = context.tradeAction ?? nested.action;
  const quantityRaw = context.tradeQuantity ?? nested.quantity;

  if ((actionRaw !== 'buy' && actionRaw !== 'sell') || typeof quantityRaw !== 'number' || quantityRaw <= 0) {
    return null;
  }

  return { action: actionRaw, quantity: quantityRaw };
}

function extractUsage(value: unknown): { usage: UsageMetrics | undefined; outputData: Record<string, unknown> } {
  const outputRecord = toRecord(value);
  const usageCandidate = asRecord(outputRecord._usage);
  const tokensIn = usageCandidate.tokensIn;
  const tokensOut = usageCandidate.tokensOut;
  const costUsd = usageCandidate.costUsd;

  const hasUsage =
    typeof tokensIn === 'number' && Number.isFinite(tokensIn) &&
    typeof tokensOut === 'number' && Number.isFinite(tokensOut) &&
    typeof costUsd === 'number' && Number.isFinite(costUsd);

  if (!hasUsage) {
    return { usage: undefined, outputData: outputRecord };
  }

  const { _usage, ...withoutUsage } = outputRecord;
  return {
    usage: {
      tokensIn,
      tokensOut,
      costUsd
    },
    outputData: withoutUsage
  };
}

async function fetchFastPathCandidate(ticker: string): Promise<{ id: string; content: string; updatedAt: Date; confidence: 'low' | 'medium' | 'high' } | null> {
  const entry = await db.kbEntry.findFirst({
    where: { ticker, entryType: 'thesis' },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, content: true, updatedAt: true, metadata: true }
  });

  if (entry === null) {
    return null;
  }

  const metadata = entry.metadata as Record<string, unknown>;
  const confidenceRaw = metadata.confidence;
  const confidence = confidenceRaw === 'high' || confidenceRaw === 'medium' || confidenceRaw === 'low' ? confidenceRaw : 'medium';

  return {
    id: entry.id,
    content: entry.content,
    updatedAt: entry.updatedAt,
    confidence
  };
}

function buildEmbeddingFallback(): number[] {
  return Array.from({ length: KB_EMBEDDING_VECTOR_LENGTH }, () => 0.0001);
}

async function runStep<T>(
  missionId: string,
  stepsExecuted: string[],
  name: string,
  inputData: Record<string, unknown>,
  execute: () => Promise<T>
): Promise<T> {
  const started = Date.now();

  try {
    const output = await execute();
    const usage = extractUsage(output);
    await writeAgentRun({
      missionId,
      agentName: name,
      inputData,
      outputData: usage.outputData,
      status: 'success',
      durationMs: Date.now() - started,
      ...(usage.usage === undefined ? {} : usage.usage)
    });
    stepsExecuted.push(name);
    return output;
  } catch (error) {
    await writeAgentRun({
      missionId,
      agentName: name,
      inputData,
      status: 'error',
      errorMessage: (error as Error).message,
      durationMs: Date.now() - started
    });
    throw error;
  }
}

export async function runManager(input: ManagerInput, deps: ManagerDependencies = defaultDependencies()): Promise<ManagerOutput> {
  const parsed = managerInputSchema.parse(input);
  const missionType = deriveMissionType(parsed);
  const tickers = parseTickers(parsed);
  const ticker = tickers[0] ?? null;
  const stepsExecuted: string[] = [];
  const context = asRecord(parsed.context);
  const synthesize = buildTestSynthesizer();

  const missionId = await startMission({
    ...(parsed.missionId === undefined ? {} : { missionId: parsed.missionId }),
    ...(parsed.userId === undefined ? {} : { userId: parsed.userId }),
    type: missionType,
    trigger: parsed.triggerType,
    tickers,
    inputData: {
      message: parsed.message ?? null,
      tickers,
      context,
      pipeline: resolveMissionPipeline(missionType).steps
    }
  });

  const resolvedTraceUrl = process.env.LANGSMITH_API_KEY !== undefined
    ? `https://smith.langchain.com/projects/${process.env.LANGSMITH_PROJECT ?? 'default'}/runs/${missionId}`
    : undefined;

  try {
    const fastPathCandidate = ticker === null ? null : await fetchFastPathCandidate(ticker);
    const fastPath = resolveFastPath({
      missionType,
      ticker,
      thesisFreshnessHours: getConfig().app.kbFastPathFreshnessHours,
      now: deps.now(),
      candidate: fastPathCandidate
    });

    if (fastPath.hit && fastPath.entry !== null) {
      const output = {
        missionId,
        missionType,
        response: fastPath.entry.content,
        trigger: 'kb_fast_path' as const,
        stepsExecuted,
        ...(resolvedTraceUrl === undefined ? {} : { traceUrl: resolvedTraceUrl })
      };
      await completeMission(missionId, output);
      return managerOutputSchema.parse(output);
    }

    if (missionType === MissionType.PATTERN_REQUEST) {
      const periodWeeks = resolvePatternPeriodWeeks(context);
      const technical = await runStep(missionId, stepsExecuted, 'technician', { ticker: ticker ?? 'UNKNOWN', periodWeeks }, async () =>
        runTechnician({ ticker: ticker ?? 'UNKNOWN', periodWeeks })
      );

      const reporterPayload = { summary: technical.summary, technical };
      await runStep(missionId, stepsExecuted, 'reporter', { missionType }, async () =>
        runReporter(
          {
            userId: parsed.userId ?? 'system',
            missionId,
            missionType,
            payload: reporterPayload
          },
          {
            formatPrimary: async (value) => JSON.stringify(value.payload),
            formatFallback: async (value) => JSON.stringify(value.payload),
            sendTelegram: async () => {},
            persistDailyBrief: async () => null
          }
        )
      );

      const output = {
        missionId,
        missionType,
        response: technical.summary,
        trigger: 'pipeline' as const,
        stepsExecuted,
        ...(resolvedTraceUrl === undefined ? {} : { traceUrl: resolvedTraceUrl })
      };
      await completeMission(missionId, output);
      return managerOutputSchema.parse(output);
    }

    if (missionType === MissionType.DAILY_BRIEF) {
      if (tickers.length === 0) {
        throw new Error('daily_brief requires at least one ticker');
      }

      const branches = await Promise.all(
        tickers.map(async (symbol) => {
          const research = await runStep(missionId, stepsExecuted, 'researcher', { ticker: symbol, missionType }, async () =>
            runResearcher({ ticker: symbol, missionType, focusQuestions: [parsed.message ?? 'daily brief update'] })
          );

          const analystOutput = await runStep(missionId, stepsExecuted, 'analyst', { missionType, ticker: symbol }, async () =>
            runAnalyst(
              {
                userId: parsed.userId ?? 'system',
                missionId,
                mode: 'standard',
                research
              },
              { synthesize }
            )
          );

          const bookkeeperOutput = await runStep(missionId, stepsExecuted, 'bookkeeper', { missionType, ticker: symbol }, async () =>
            runBookkeeper(
              {
                userId: parsed.userId ?? 'system',
                missionId,
                missionType,
                analystOutput
              },
              {
                getPriorThesis: async (existingTicker) => {
                  const entry = await db.kbEntry.findFirst({ where: { ticker: existingTicker, entryType: 'thesis' }, orderBy: { updatedAt: 'desc' }, select: { id: true, content: true, metadata: true } });
                  if (entry === null) {
                    return null;
                  }

                  const confidenceRaw = (entry.metadata as Record<string, unknown>).confidence;
                  const confidence = confidenceRaw === 'high' || confidenceRaw === 'medium' || confidenceRaw === 'low' ? confidenceRaw : 'medium';
                  return { kbEntryId: entry.id, content: entry.content, confidence };
                },
                assessContradiction: async (prior, next) => {
                  if (prior === null) {
                    return 'none';
                  }
                  return prior.content.trim().toLowerCase() === next.thesisUpdate.trim().toLowerCase() ? 'none' : 'high';
                },
                generateEmbedding: async () => buildEmbeddingFallback(),
                persist: async ({ parsed: bookInput, prior, contradictionSeverity, changeType }) => {
                  const normalizedTicker = Array.isArray(bookInput.analystOutput.ticker) ? bookInput.analystOutput.ticker[0] : bookInput.analystOutput.ticker;
                  if (normalizedTicker === undefined) {
                    throw new Error('Missing ticker for daily brief bookkeeper persistence');
                  }

                  const snapshotCreated = prior !== null;
                  if (snapshotCreated) {
                    await db.kbThesisSnapshot.create({
                      data: {
                        ticker: normalizedTicker,
                        thesis: prior.content,
                        confidence: prior.confidence,
                        changeType,
                        missionId: bookInput.missionId,
                        changeSummary: 'pre-overwrite snapshot'
                      }
                    });
                  }

                  const entry = await db.kbEntry.create({
                    data: {
                      ticker: normalizedTicker,
                      entryType: 'thesis',
                      content: bookInput.analystOutput.thesisUpdate,
                      metadata: {
                        confidence: bookInput.analystOutput.confidence,
                        changeType,
                        contradictionSeverity
                      },
                      contradictionFlag: contradictionSeverity === 'high',
                      contradictionNote: contradictionSeverity === 'high' ? 'high severity contradiction detected' : null,
                      missionId: bookInput.missionId
                    }
                  });

                  return { kbEntryId: entry.id, snapshotCreated };
                }
              }
            )
          );

          return {
            ticker: symbol,
            analyst: toRecord(analystOutput),
            bookkeeper: toRecord(bookkeeperOutput)
          };
        })
      );

      const summary = `Daily brief generated for ${tickers.length} ticker(s): ${tickers.join(', ')}`;
      const reporterPayload: Record<string, unknown> = {
        summary,
        branches
      };

      await runStep(missionId, stepsExecuted, 'reporter', { missionType }, async () =>
        runReporter(
          {
            userId: parsed.userId ?? 'system',
            missionId,
            missionType,
            payload: reporterPayload
          },
          {
            formatPrimary: async (value) => JSON.stringify(value.payload),
            formatFallback: async (value) => JSON.stringify(value.payload),
            sendTelegram: async () => {},
            persistDailyBrief: async () => null
          }
        )
      );

      const output = {
        missionId,
        missionType,
        response: summary,
        trigger: 'pipeline' as const,
        stepsExecuted,
        ...(resolvedTraceUrl === undefined ? {} : { traceUrl: resolvedTraceUrl })
      };

      await completeMission(missionId, output);
      return managerOutputSchema.parse(output);
    }

    let analystInput: RunAnalystInput;
    if (missionType === MissionType.COMPARISON) {
      assertComparisonCardinality(tickers);
      const researchItems = await Promise.all(
        tickers.map((symbol) =>
          runStep(missionId, stepsExecuted, 'researcher', { ticker: symbol, missionType }, async () =>
            runResearcher({ ticker: symbol, missionType, focusQuestions: ['comparison'] })
          )
        )
      );

      analystInput = {
        userId: parsed.userId ?? 'system',
        missionId,
        mode: 'comparison',
        research: researchItems
      };
    } else {
      const research = await runStep(missionId, stepsExecuted, 'researcher', { ticker: ticker ?? 'UNKNOWN', missionType }, async () =>
        runResearcher({ ticker: ticker ?? 'UNKNOWN', missionType, focusQuestions: [parsed.message ?? 'general update'] })
      );

      analystInput = {
        userId: parsed.userId ?? 'system',
        missionId,
        mode: missionType === MissionType.DEVIL_ADVOCATE ? 'devil_advocate' : 'standard',
        research
      };
    }

    let analystOutput = await runStep(missionId, stepsExecuted, 'analyst', { missionType }, async () =>
      runAnalyst(analystInput, { synthesize })
    );

    const reDispatchEnabled = getConfig().agents.confidence.reDispatchOnLow;
    if (missionType !== MissionType.COMPARISON && shouldReDispatch({ enabled: reDispatchEnabled, confidence: analystOutput.confidence, alreadyReDispatched: false })) {
      const focused = await runStep(missionId, stepsExecuted, 'researcher', { ticker: ticker ?? 'UNKNOWN', missionType }, async () =>
        runResearcher({ ticker: ticker ?? 'UNKNOWN', missionType, focusQuestions: analystOutput.contradictions })
      );

      analystInput = { ...analystInput, research: focused };
      analystOutput = await runStep(missionId, stepsExecuted, 'analyst', { missionType, redispatch: true }, async () =>
        runAnalyst(analystInput, { synthesize })
      );
    }

    const bookkeeperOutput = await runStep(missionId, stepsExecuted, 'bookkeeper', { missionType }, async () =>
      runBookkeeper(
        {
          userId: parsed.userId ?? 'system',
          missionId,
          missionType,
          analystOutput
        },
        {
          getPriorThesis: async (symbol) => {
            const entry = await db.kbEntry.findFirst({ where: { ticker: symbol, entryType: 'thesis' }, orderBy: { updatedAt: 'desc' }, select: { id: true, content: true, metadata: true } });
            if (entry === null) {
              return null;
            }

            const confidenceRaw = (entry.metadata as Record<string, unknown>).confidence;
            const confidence = confidenceRaw === 'high' || confidenceRaw === 'medium' || confidenceRaw === 'low' ? confidenceRaw : 'medium';
            return { kbEntryId: entry.id, content: entry.content, confidence };
          },
          assessContradiction: async (prior, next) => {
            if (prior === null) {
              return 'none';
            }
            return prior.content.trim().toLowerCase() === next.thesisUpdate.trim().toLowerCase() ? 'none' : 'high';
          },
          generateEmbedding: async () => buildEmbeddingFallback(),
          persist: async ({ parsed: bookInput, prior, contradictionSeverity, changeType }) => {
            const symbol = Array.isArray(bookInput.analystOutput.ticker) ? bookInput.analystOutput.ticker[0] : bookInput.analystOutput.ticker;
            if (symbol === undefined) {
              throw new Error('Missing ticker for bookkeeper persistence');
            }

            const snapshotCreated = prior !== null;
            if (snapshotCreated) {
              await db.kbThesisSnapshot.create({
                data: {
                  ticker: symbol,
                  thesis: prior.content,
                  confidence: prior.confidence,
                  changeType,
                  missionId: bookInput.missionId,
                  changeSummary: 'pre-overwrite snapshot'
                }
              });
            }

            const entry = await db.kbEntry.create({
              data: {
                ticker: symbol,
                entryType: 'thesis',
                content: bookInput.analystOutput.thesisUpdate,
                metadata: {
                  confidence: bookInput.analystOutput.confidence,
                  changeType,
                  contradictionSeverity
                },
                contradictionFlag: contradictionSeverity === 'high',
                contradictionNote: contradictionSeverity === 'high' ? 'high severity contradiction detected' : null,
                missionId: bookInput.missionId
              }
            });

            return { kbEntryId: entry.id, snapshotCreated };
          }
        }
      )
    );

    let traderOutput: Record<string, unknown> | null = null;
    if (missionType === MissionType.TRADE_REQUEST) {
      if (ticker === null) {
        throw new Error('Trade request requires ticker');
      }

      const tradeParams = resolveTradeParams(context);
      if (tradeParams === null) {
        throw new Error('Trade request requires context.tradeAction and context.tradeQuantity');
      }

      traderOutput = toRecord(
        await runStep(missionId, stepsExecuted, 'trader', { ticker, action: tradeParams.action, quantity: tradeParams.quantity }, async () =>
          runTrader({ userId: parsed.userId ?? 'system', missionId, ticker, action: tradeParams.action, quantity: tradeParams.quantity, analystOutput })
        )
      );
    }

    const reporterPayload: Record<string, unknown> = {
      summary: analystOutput.thesisUpdate,
      analyst: toRecord(analystOutput),
      bookkeeper: toRecord(bookkeeperOutput),
      ...(traderOutput === null ? {} : { trader: traderOutput })
    };

    await runStep(missionId, stepsExecuted, 'reporter', { missionType }, async () =>
      runReporter(
        {
          userId: parsed.userId ?? 'system',
          missionId,
          missionType,
          payload: reporterPayload
        },
        {
          formatPrimary: async (value) => JSON.stringify(value.payload),
          formatFallback: async (value) => JSON.stringify(value.payload),
          sendTelegram: async () => {},
          persistDailyBrief: async () => null
        }
      )
    );

    const output = {
      missionId,
      missionType,
      response: typeof reporterPayload.summary === 'string' ? reporterPayload.summary : JSON.stringify(reporterPayload),
      trigger: 'pipeline' as const,
      stepsExecuted,
      ...(resolvedTraceUrl === undefined ? {} : { traceUrl: resolvedTraceUrl })
    };

    await completeMission(missionId, output);
    return managerOutputSchema.parse(output);
  } catch (error) {
    await failMission(missionId, (error as Error).message);
    throw error;
  }
}




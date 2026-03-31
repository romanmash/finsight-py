import { Prisma, type PrismaClient } from '@prisma/client';

import { db } from '../lib/db.js';
import { getConfig } from '../lib/config.js';
import { getMcpToolRegistry } from '../mcp/index.js';
import { createRecoverableFailure, setCollectorActive, setCollectorError, setCollectorIdle } from './shared/collector-state.js';
import type { DiscoveryFinding, DiscoveryRunPersisted, ScreenerTrigger } from '../types/collectors.js';
import { screenerTriggerSchema } from '../types/collectors.js';

interface ToolInvoker {
  invoke: (input: unknown) => Promise<{ output?: unknown; error?: { message: string } }>;
}

interface ScreenerDependencies {
  prisma: PrismaClient;
  getTool: (name: string) => ToolInvoker | null;
  getRuntimeConfig: () => ReturnType<typeof getConfig>;
  setActiveState: () => Promise<void>;
  setIdleState: (summary: string) => Promise<void>;
  setErrorState: (message: string) => Promise<void>;
}

function defaultDependencies(): ScreenerDependencies {
  const registry = getMcpToolRegistry();
  return {
    prisma: db,
    getTool: (name: string) => (registry.all[name] as ToolInvoker | undefined) ?? null,
    getRuntimeConfig: () => getConfig(),
    setActiveState: () => setCollectorActive('screener', 'market-discovery'),
    setIdleState: (summary: string) => setCollectorIdle('screener', summary),
    setErrorState: (message: string) => setCollectorError('screener', message)
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseFindings(raw: unknown): DiscoveryFinding[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const findings: DiscoveryFinding[] = [];
  for (const entry of raw) {
    const record = asRecord(entry);
    if (record === null) {
      continue;
    }

    const ticker = typeof record.ticker === 'string' ? record.ticker : null;
    const sector = typeof record.sector === 'string' ? record.sector : null;
    const reason = typeof record.reason === 'string' ? record.reason : null;
    const signalScore = typeof record.signalScore === 'number' ? record.signalScore : null;
    const supportingHeadline = typeof record.supportingHeadline === 'string' ? record.supportingHeadline : undefined;

    if (ticker === null || sector === null || reason === null || signalScore === null) {
      continue;
    }

    findings.push({
      ticker: ticker.toUpperCase(),
      sector,
      reason,
      signalScore,
      ...(supportingHeadline !== undefined ? { supportingHeadline } : {})
    });
  }

  return findings;
}

export async function runScreener(
  input: { triggeredBy: ScreenerTrigger },
  deps: ScreenerDependencies = defaultDependencies()
): Promise<DiscoveryRunPersisted> {
  const parsedTrigger = screenerTriggerSchema.safeParse(input.triggeredBy);
  if (!parsedTrigger.success) {
    throw createRecoverableFailure('VALIDATION_ERROR', 'invalid screener trigger', {
      triggeredBy: input.triggeredBy
    });
  }

  await deps.setActiveState();

  try {
    const config = deps.getRuntimeConfig();
    const tool = deps.getTool('screen_market');
    let findings: DiscoveryFinding[] = [];

    if (tool !== null) {
      const invokeResult = await tool.invoke({
        sectors: config.screener.sectors,
        minimumSignalScore: config.screener.minimumSignalScore,
        topResultsPerRun: config.screener.topResultsPerRun
      });

      if (invokeResult.error === undefined) {
        const payload = asRecord(invokeResult.output);
        findings = parseFindings(payload?.results);
      }
    }

    findings = findings
      .sort((left, right) => right.signalScore - left.signalScore)
      .slice(0, config.screener.topResultsPerRun);

    const persisted = await deps.prisma.screenerRun.create({
      data: {
        triggeredBy: parsedTrigger.data,
        results: {
          results: findings,
          metadata: {
            no_candidates: findings.length === 0
          }
        } as unknown as Prisma.InputJsonValue
      }
    });

    const response: DiscoveryRunPersisted = {
      runId: persisted.id,
      triggeredBy: parsedTrigger.data,
      results: findings,
      metadata: {
        noCandidates: findings.length === 0
      }
    };

    await deps.setIdleState(`results=${String(findings.length)} trigger=${parsedTrigger.data}`);
    return response;
  } catch (error) {
    await deps.setErrorState((error as Error).message);
    throw createRecoverableFailure('UPSTREAM_UNAVAILABLE', 'screener run failed', {
      errorMessage: (error as Error).message
    });
  }
}
import type { JobType } from 'bullmq';
import { AgentName, type AgentName as AgentNameType } from '@finsight/shared-types';

import { getConfig } from './config.js';
import { db } from './db.js';
import {
  alertPipelineQueue,
  dailyBriefQueue,
  earningsCheckQueue,
  screenerScanQueue,
  ticketExpiryQueue,
  watchdogScanQueue
} from './queues.js';
import { RedisKey, redis } from './redis.js';

const AGENT_NAMES = Object.values(AgentName) as AgentNameType[];
const DEFAULT_STATUS_TIMEOUT_MS = 5000;
const DEFAULT_SPEND_CACHE_TTL_SEC = 30;

export interface AgentStatusEntry {
  state: 'active' | 'queued' | 'idle' | 'error';
  currentTask: string | null;
  currentMissionId: string | null;
  model: string | null;
  provider: string | null;
  todayTokensIn: number;
  todayTokensOut: number;
  todayCostUsd: number;
  lastActiveAt: string | null;
  errorMessage: string | null;
}

export interface ServiceHealthEntry {
  status: 'ok' | 'degraded' | 'error';
  message: string | null;
  checkedAt: string;
}

export interface AdminStatusSnapshot {
  generatedAt: string;
  degraded: boolean;
  agents: Record<AgentNameType, AgentStatusEntry>;
  spend: {
    todayTotalUsd: number;
    byProvider: Record<string, number>;
  };
  mission: {
    active: {
      id: string;
      type: string;
      status: string;
      tickers: string[];
      trigger: string;
      createdAt: string;
    } | null;
    recent: Array<{
      id: string;
      type: string;
      status: string;
      tickers: string[];
      createdAt: string;
      completedAt: string | null;
    }>;
  };
  health: {
    postgres: ServiceHealthEntry;
    redis: ServiceHealthEntry;
    mcpServers: Record<string, ServiceHealthEntry>;
    lmStudio: ServiceHealthEntry;
    telegramBot: ServiceHealthEntry;
  };
  kb: {
    totalEntries: number;
    contradictionCount: number;
    lastWriteAt: string | null;
    tickersTracked: number;
  };
  queues: {
    depths: Record<string, number>;
    pendingAlerts: number;
    pendingTickets: number;
  };
  errors: Array<{ section: string; message: string }>;
}

function getStatusTimeoutMs(): number {
  const configured = process.env.ADMIN_STATUS_TIMEOUT_MS;
  if (configured === undefined) {
    return DEFAULT_STATUS_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(configured, 10);
  return Number.isNaN(parsed) ? DEFAULT_STATUS_TIMEOUT_MS : parsed;
}

function getSpendCacheTtlSeconds(): number {
  const configured = process.env.ADMIN_STATUS_SPEND_CACHE_TTL_SEC;
  if (configured === undefined) {
    return DEFAULT_SPEND_CACHE_TTL_SEC;
  }

  const parsed = Number.parseInt(configured, 10);
  return Number.isNaN(parsed) ? DEFAULT_SPEND_CACHE_TTL_SEC : parsed;
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function emptyAgentEntry(): AgentStatusEntry {
  return {
    state: 'idle',
    currentTask: null,
    currentMissionId: null,
    model: null,
    provider: null,
    todayTokensIn: 0,
    todayTokensOut: 0,
    todayCostUsd: 0,
    lastActiveAt: null,
    errorMessage: null
  };
}

function parseAgentState(raw: string | null): Partial<AgentStatusEntry> {
  if (raw === null) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AgentStatusEntry>;
    return parsed;
  } catch {
    return {};
  }
}

async function loadAgentStates(now: Date): Promise<Record<AgentNameType, AgentStatusEntry>> {
  const keys = AGENT_NAMES.map((name) => RedisKey.agentState(name));
  const values = await redis.mget(...keys);

  const todayRuns = await db.agentRun.findMany({
    where: { createdAt: { gte: startOfDay(now) } },
    select: {
      agentName: true,
      model: true,
      provider: true,
      tokensIn: true,
      tokensOut: true,
      costUsd: true,
      createdAt: true,
      errorMessage: true
    },
    orderBy: { createdAt: 'desc' }
  });

  const result = {} as Record<AgentNameType, AgentStatusEntry>;

  for (const name of AGENT_NAMES) {
    result[name] = emptyAgentEntry();
  }

  for (let index = 0; index < AGENT_NAMES.length; index += 1) {
    const name = AGENT_NAMES[index];
    if (name === undefined) {
      continue;
    }

    const redisState = parseAgentState(values[index] ?? null);
    result[name] = {
      ...result[name],
      ...redisState
    };
  }

  for (const run of todayRuns) {
    const agent = run.agentName as AgentNameType;
    if (!(agent in result)) {
      continue;
    }

    const current = result[agent];
    current.todayTokensIn += run.tokensIn ?? 0;
    current.todayTokensOut += run.tokensOut ?? 0;
    current.todayCostUsd += run.costUsd ?? 0;

    if (current.model === null) {
      current.model = run.model;
      current.provider = run.provider;
      current.lastActiveAt = run.createdAt.toISOString();
      current.errorMessage = run.errorMessage;
    }
  }

  return result;
}

interface SpendSummary {
  todayTotalUsd: number;
  byProvider: Record<string, number>;
}

async function loadSpendSummary(now: Date): Promise<SpendSummary> {
  const dateKey = now.toISOString().slice(0, 10);
  const cacheKey = `admin:status:spend:${dateKey}`;
  const cached = await redis.get(cacheKey);
  if (cached !== null) {
    return JSON.parse(cached) as SpendSummary;
  }

  const byProviderRows = await db.agentRun.groupBy({
    by: ['provider'],
    where: { createdAt: { gte: startOfDay(now) } },
    _sum: { costUsd: true }
  });

  const byProvider: Record<string, number> = {};
  let total = 0;
  for (const row of byProviderRows) {
    const value = row._sum.costUsd ?? 0;
    byProvider[row.provider] = value;
    total += value;
  }

  const summary: SpendSummary = {
    todayTotalUsd: total,
    byProvider
  };

  await redis.set(cacheKey, JSON.stringify(summary), 'EX', getSpendCacheTtlSeconds());

  return summary;
}

async function loadMissionSummary(): Promise<AdminStatusSnapshot['mission']> {
  const [active, recent] = await Promise.all([
    db.mission.findFirst({
      where: { status: 'running' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        status: true,
        tickers: true,
        trigger: true,
        createdAt: true
      }
    }),
    db.mission.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        status: true,
        tickers: true,
        createdAt: true,
        completedAt: true
      }
    })
  ]);

  return {
    active:
      active === null
        ? null
        : {
            ...active,
            createdAt: active.createdAt.toISOString()
          },
    recent: recent.map((mission: { id: string; type: string; status: string; tickers: string[]; createdAt: Date; completedAt: Date | null }) => ({
      id: mission.id,
      type: mission.type,
      status: mission.status,
      tickers: mission.tickers,
      createdAt: mission.createdAt.toISOString(),
      completedAt: mission.completedAt?.toISOString() ?? null
    }))
  };
}

async function loadKbSummary(): Promise<AdminStatusSnapshot['kb']> {
  const [totalEntries, contradictionCount, lastWrite, trackedTickers] = await Promise.all([
    db.kbEntry.count(),
    db.kbEntry.count({ where: { contradictionFlag: true } }),
    db.kbEntry.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    }),
    db.kbEntry.findMany({
      where: { ticker: { not: null } },
      select: { ticker: true },
      distinct: ['ticker']
    })
  ]);

  return {
    totalEntries,
    contradictionCount,
    lastWriteAt: lastWrite?.createdAt.toISOString() ?? null,
    tickersTracked: trackedTickers.length
  };
}

async function queueDepth(queue: { getJobCounts: (...states: JobType[]) => Promise<Record<string, number>> }): Promise<number> {
  const counts = await queue.getJobCounts('waiting', 'active', 'delayed');
  return (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.delayed ?? 0);
}

async function loadQueueSummary(): Promise<AdminStatusSnapshot['queues']> {
  const [watchdogDepth, screenerDepth, dailyBriefDepth, earningsDepth, ticketExpiryDepth, alertPipelineDepth] = await Promise.all([
    queueDepth(watchdogScanQueue),
    queueDepth(screenerScanQueue),
    queueDepth(dailyBriefQueue),
    queueDepth(earningsCheckQueue),
    queueDepth(ticketExpiryQueue),
    queueDepth(alertPipelineQueue)
  ]);

  return {
    depths: {
      watchdogScan: watchdogDepth,
      screenerScan: screenerDepth,
      dailyBrief: dailyBriefDepth,
      earningsCheck: earningsDepth,
      ticketExpiry: ticketExpiryDepth,
      alertPipeline: alertPipelineDepth
    },
    pendingAlerts: alertPipelineDepth,
    pendingTickets: ticketExpiryDepth
  };
}

async function checkUrlHealth(url: string): Promise<ServiceHealthEntry> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return {
      status: response.ok ? 'ok' : 'degraded',
      message: response.ok ? null : `HTTP ${String(response.status)}`,
      checkedAt
    };
  } catch (error) {
    return {
      status: 'error',
      message: (error as Error).message,
      checkedAt
    };
  }
}

async function loadHealthSummary(): Promise<AdminStatusSnapshot['health']> {
  const checkedAt = new Date().toISOString();

  const postgres = await (async (): Promise<ServiceHealthEntry> => {
    try {
      await db.$queryRaw`SELECT 1`;
      return { status: 'ok', message: null, checkedAt };
    } catch (error) {
      return { status: 'error', message: (error as Error).message, checkedAt };
    }
  })();

  const redisHealth = await (async (): Promise<ServiceHealthEntry> => {
    try {
      await redis.ping();
      return { status: 'ok', message: null, checkedAt };
    } catch (error) {
      return { status: 'error', message: (error as Error).message, checkedAt };
    }
  })();

  const mcpServers = {} as Record<string, ServiceHealthEntry>;
  const mcpEntries = Object.entries(getConfig().mcp.servers);
  await Promise.all(
    mcpEntries.map(async ([name, serverConfig]) => {
      mcpServers[name] = await checkUrlHealth(`${serverConfig.url}/health`);
    })
  );

  const lmStudioBaseUrl = process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234';
  const telegramHealthUrl = process.env.TELEGRAM_HEALTH_URL ?? 'http://telegram-bot:3000/health';

  return {
    postgres,
    redis: redisHealth,
    mcpServers,
    lmStudio: await checkUrlHealth(`${lmStudioBaseUrl}/v1/models`),
    telegramBot: await checkUrlHealth(telegramHealthUrl)
  };
}

function createDegradedSnapshot(message: string): AdminStatusSnapshot {
  const emptyAgents = {} as Record<AgentNameType, AgentStatusEntry>;
  for (const name of AGENT_NAMES) {
    emptyAgents[name] = emptyAgentEntry();
  }

  return {
    generatedAt: new Date().toISOString(),
    degraded: true,
    agents: emptyAgents,
    spend: {
      todayTotalUsd: 0,
      byProvider: {}
    },
    mission: {
      active: null,
      recent: []
    },
    health: {
      postgres: { status: 'degraded', message, checkedAt: new Date().toISOString() },
      redis: { status: 'degraded', message, checkedAt: new Date().toISOString() },
      mcpServers: {},
      lmStudio: { status: 'degraded', message, checkedAt: new Date().toISOString() },
      telegramBot: { status: 'degraded', message, checkedAt: new Date().toISOString() }
    },
    kb: {
      totalEntries: 0,
      contradictionCount: 0,
      lastWriteAt: null,
      tickersTracked: 0
    },
    queues: {
      depths: {},
      pendingAlerts: 0,
      pendingTickets: 0
    },
    errors: [{ section: 'status', message }]
  };
}

export async function buildAdminStatusSnapshot(now = new Date()): Promise<AdminStatusSnapshot> {
  const timeoutMs = getStatusTimeoutMs();

  try {
    const result = await Promise.race([
      (async (): Promise<AdminStatusSnapshot> => {
        const [agentsResult, spendResult, missionResult, healthResult, kbResult, queuesResult] = await Promise.allSettled([
          loadAgentStates(now),
          loadSpendSummary(now),
          loadMissionSummary(),
          loadHealthSummary(),
          loadKbSummary(),
          loadQueueSummary()
        ]);

        const errors: Array<{ section: string; message: string }> = [];

        const snapshot: AdminStatusSnapshot = {
          generatedAt: now.toISOString(),
          degraded: false,
          agents: agentsResult.status === 'fulfilled' ? agentsResult.value : createDegradedSnapshot('agents unavailable').agents,
          spend:
            spendResult.status === 'fulfilled'
              ? spendResult.value
              : {
                  todayTotalUsd: 0,
                  byProvider: {}
                },
          mission: missionResult.status === 'fulfilled' ? missionResult.value : { active: null, recent: [] },
          health:
            healthResult.status === 'fulfilled'
              ? healthResult.value
              : {
                  postgres: { status: 'degraded', message: 'health unavailable', checkedAt: now.toISOString() },
                  redis: { status: 'degraded', message: 'health unavailable', checkedAt: now.toISOString() },
                  mcpServers: {},
                  lmStudio: { status: 'degraded', message: 'health unavailable', checkedAt: now.toISOString() },
                  telegramBot: { status: 'degraded', message: 'health unavailable', checkedAt: now.toISOString() }
                },
          kb:
            kbResult.status === 'fulfilled'
              ? kbResult.value
              : {
                  totalEntries: 0,
                  contradictionCount: 0,
                  lastWriteAt: null,
                  tickersTracked: 0
                },
          queues:
            queuesResult.status === 'fulfilled'
              ? queuesResult.value
              : {
                  depths: {},
                  pendingAlerts: 0,
                  pendingTickets: 0
                },
          errors
        };

        const settledSections = [
          ['agents', agentsResult],
          ['spend', spendResult],
          ['mission', missionResult],
          ['health', healthResult],
          ['kb', kbResult],
          ['queues', queuesResult]
        ] as const;

        for (const [section, state] of settledSections) {
          if (state.status === 'rejected') {
            snapshot.degraded = true;
            errors.push({ section, message: state.reason instanceof Error ? state.reason.message : 'Unknown error' });
          }
        }

        return snapshot;
      })(),
      new Promise<AdminStatusSnapshot>((_, reject) => {
        setTimeout(() => reject(new Error('Status aggregation timeout exceeded')), timeoutMs);
      })
    ]);

    return result;
  } catch (error) {
    return createDegradedSnapshot((error as Error).message);
  }
}


import type { Prisma } from '@prisma/client';

import { getConfig } from '../../lib/config.js';
import { computeCostUsd } from '../../lib/pricing.js';
import { db } from '../../lib/db.js';

interface MissionSeedInput {
  missionId?: string;
  userId?: string;
  type: string;
  trigger: string;
  tickers: string[];
  inputData: Record<string, unknown>;
}

interface AgentRunSeed {
  missionId: string;
  agentName: string;
  inputData: Record<string, unknown>;
  outputData?: Record<string, unknown>;
  status: 'success' | 'error';
  errorMessage?: string;
  durationMs: number;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
}

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function resolveAgentRuntime(agentName: string): { provider: string; model: string } {
  const agents = getConfig().agents;
  const candidate = (agents as unknown as Record<string, unknown>)[agentName];
  if (typeof candidate !== 'object' || candidate === null || !('primary' in candidate)) {
    return { provider: 'unknown', model: 'unknown' };
  }

  const primary = (candidate as { primary: { provider: string; model: string } }).primary;
  return {
    provider: primary.provider,
    model: primary.model
  };
}

export async function startMission(seed: MissionSeedInput): Promise<string> {
  if (seed.missionId !== undefined) {
    await db.mission.update({
      where: { id: seed.missionId },
      data: {
        status: 'running',
        type: seed.type,
        trigger: seed.trigger,
        tickers: seed.tickers,
        inputData: toInputJson(seed.inputData),
        userId: seed.userId ?? null
      }
    });

    return seed.missionId;
  }

  const mission = await db.mission.create({
    data: {
      userId: seed.userId ?? null,
      type: seed.type,
      status: 'running',
      trigger: seed.trigger,
      inputData: toInputJson(seed.inputData),
      tickers: seed.tickers
    }
  });

  return mission.id;
}

export async function completeMission(missionId: string, outputData: Record<string, unknown>): Promise<void> {
  await db.mission.update({
    where: { id: missionId },
    data: {
      status: 'complete',
      outputData: toInputJson(outputData),
      completedAt: new Date()
    }
  });
}

export async function failMission(missionId: string, message: string): Promise<void> {
  await db.mission.update({
    where: { id: missionId },
    data: {
      status: 'failed',
      outputData: toInputJson({ error: message }),
      completedAt: new Date()
    }
  });
}

export async function writeAgentRun(seed: AgentRunSeed): Promise<void> {
  const runtime = resolveAgentRuntime(seed.agentName);
  const tokensIn = seed.tokensIn ?? 0;
  const tokensOut = seed.tokensOut ?? 0;
  const costUsd =
    seed.costUsd ??
    (tokensIn > 0 || tokensOut > 0 ? computeCostUsd(runtime.provider, runtime.model, tokensIn, tokensOut) : 0);

  await db.agentRun.create({
    data: {
      missionId: seed.missionId,
      agentName: seed.agentName,
      provider: runtime.provider,
      model: runtime.model,
      inputData: toInputJson(seed.inputData),
      ...(seed.outputData === undefined ? {} : { outputData: toInputJson(seed.outputData) }),
      toolCalls: [],
      status: seed.status,
      ...(seed.errorMessage === undefined ? {} : { errorMessage: seed.errorMessage }),
      durationMs: seed.durationMs,
      tokensIn,
      tokensOut,
      costUsd
    }
  });
}



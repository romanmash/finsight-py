import { Hono } from 'hono';

import { db } from '../lib/db.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import type { AppEnv } from '../types/hono-context.js';

export function createMissionsRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized();
    }

    const where = principal.role === 'admin' ? {} : { userId: principal.userId };
    const missions = await db.mission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        type: true,
        status: true,
        trigger: true,
        tickers: true,
        createdAt: true,
        completedAt: true
      }
    });

    return c.json({
      missions: missions.map((mission) => ({
        ...mission,
        createdAt: mission.createdAt.toISOString(),
        completedAt: mission.completedAt?.toISOString() ?? null
      }))
    });
  });

  router.get('/:id', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized();
    }

    const id = c.req.param('id');
    const mission = await db.mission.findUnique({
      where: { id },
      include: {
        agentRuns: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (mission === null) {
      return c.json({ mission: null });
    }

    if (principal.role !== 'admin' && mission.userId !== principal.userId) {
      throw forbidden('Mission does not belong to principal');
    }

    const outputData = mission.outputData as Record<string, unknown> | null;
    const traceUrl = outputData !== null && typeof outputData.traceUrl === 'string' ? outputData.traceUrl : null;

    return c.json({
      mission: {
        id: mission.id,
        type: mission.type,
        status: mission.status,
        trigger: mission.trigger,
        tickers: mission.tickers,
        inputData: mission.inputData,
        outputData: mission.outputData,
        traceUrl,
        createdAt: mission.createdAt.toISOString(),
        completedAt: mission.completedAt?.toISOString() ?? null,
        agentRuns: mission.agentRuns.map((run) => ({
          id: run.id,
          agentName: run.agentName,
          provider: run.provider,
          model: run.model,
          status: run.status,
          durationMs: run.durationMs,
          tokensIn: run.tokensIn,
          tokensOut: run.tokensOut,
          costUsd: run.costUsd,
          confidence: run.confidence,
          confidenceReason: run.confidenceReason,
          errorMessage: run.errorMessage,
          createdAt: run.createdAt.toISOString()
        }))
      }
    });
  });

  return router;
}


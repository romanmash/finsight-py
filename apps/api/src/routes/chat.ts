import { Hono } from 'hono';

import { runManager } from '../agents/manager.js';
import { badRequest, unauthorized } from '../lib/errors.js';
import type { AppEnv } from '../types/hono-context.js';

interface ChatPayload {
  message?: string;
  ticker?: string;
  tickers?: string[];
}

export function createChatRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post('/', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized();
    }

    const body = (await c.req.json().catch(() => ({}))) as ChatPayload;
    if (typeof body.message !== 'string' || body.message.trim().length === 0) {
      throw badRequest('message is required');
    }

    const output = await runManager({
      userId: principal.userId,
      message: body.message,
      ticker: body.ticker,
      tickers: body.tickers,
      triggerType: 'user'
    });

    return c.json({
      missionId: output.missionId,
      response: output.response,
      missionType: output.missionType,
      trigger: output.trigger
    });
  });

  return router;
}

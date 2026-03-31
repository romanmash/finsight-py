import { Hono } from 'hono';
import { z } from 'zod';

import { dispatchTelegramInternalPush } from '../lib/telegram-internal.js';
import type { AppEnv } from '../types/hono-context.js';

const pushSchema = z.object({
  userId: z.string().min(1),
  message: z.string().min(1),
  sourceType: z.enum(['alert', 'daily_brief', 'system']),
  missionId: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional()
}).strict();

export function createTelegramInternalRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post('/push', async (c) => {
    const expectedToken = process.env.TELEGRAM_INTERNAL_TOKEN;
    if (expectedToken === undefined || expectedToken.length === 0) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Internal token is not configured' } }, 403);
    }

    const token = c.req.header('x-internal-token');
    if (token !== expectedToken) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Invalid internal token' } }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = pushSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }, 400);
    }

    const result = await dispatchTelegramInternalPush(parsed.data);
    return c.json(result);
  });

  return router;
}

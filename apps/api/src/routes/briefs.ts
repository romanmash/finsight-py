import { Hono } from 'hono';

import { db } from '../lib/db.js';
import type { AppEnv } from '../types/hono-context.js';

export function createBriefsRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/latest', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401);
    }

    const latest = await db.dailyBrief.findFirst({
      where: {
        userId: principal.userId
      },
      orderBy: {
        generatedAt: 'desc'
      }
    });

    if (latest === null) {
      return c.json({ brief: null });
    }

    return c.json({
      brief: {
        id: latest.id,
        date: latest.date,
        rawText: latest.rawText,
        generatedAt: latest.generatedAt.toISOString()
      }
    });
  });

  return router;
}

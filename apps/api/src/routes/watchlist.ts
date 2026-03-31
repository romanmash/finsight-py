import { Hono } from 'hono';

import { db } from '../lib/db.js';
import { badRequest, unauthorized } from '../lib/errors.js';
import type { AppEnv } from '../types/hono-context.js';

interface WatchlistInput {
  ticker?: string;
  name?: string;
  sector?: string;
  listType?: string;
}

export function createWatchlistRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized();
    }

    const items = await db.watchlistItem.findMany({
      where: { userId: principal.userId, active: true },
      orderBy: { addedAt: 'desc' }
    });

    return c.json({
      items: items.map((item) => ({
        id: item.id,
        ticker: item.ticker,
        name: item.name,
        sector: item.sector,
        listType: item.listType,
        addedAt: item.addedAt.toISOString()
      }))
    });
  });

  router.post('/', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized();
    }

    const payload = (await c.req.json().catch(() => ({}))) as WatchlistInput;
    if (typeof payload.ticker !== 'string' || payload.ticker.trim().length === 0) {
      throw badRequest('ticker is required');
    }

    const created = await db.watchlistItem.create({
      data: {
        userId: principal.userId,
        ticker: payload.ticker.toUpperCase(),
        name: payload.name ?? payload.ticker.toUpperCase(),
        sector: payload.sector ?? 'unknown',
        listType: payload.listType ?? 'interesting',
        active: true
      }
    });

    return c.json({
      item: {
        id: created.id,
        ticker: created.ticker,
        name: created.name,
        sector: created.sector,
        listType: created.listType,
        addedAt: created.addedAt.toISOString()
      }
    }, 201);
  });

  router.delete('/:id', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized();
    }

    const id = c.req.param('id');
    await db.watchlistItem.updateMany({
      where: { id, userId: principal.userId },
      data: { active: false }
    });

    return c.json({ removed: true });
  });

  return router;
}

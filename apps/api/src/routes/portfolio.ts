import { Hono } from 'hono';

import { db } from '../lib/db.js';
import { badRequest, unauthorized } from '../lib/errors.js';
import type { AppEnv } from '../types/hono-context.js';

interface PortfolioItemInput {
  ticker: string;
  quantity: number;
}

export function createPortfolioRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized();
    }

    const items = await db.portfolioItem.findMany({
      where: { userId: principal.userId },
      orderBy: { updatedAt: 'desc' }
    });

    return c.json({
      items: items.map((item) => ({
        id: item.id,
        ticker: item.ticker,
        quantity: item.quantity,
        updatedAt: item.updatedAt.toISOString()
      }))
    });
  });

  router.put('/', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized();
    }

    const payload = (await c.req.json().catch(() => ({}))) as { items?: PortfolioItemInput[] };
    if (!Array.isArray(payload.items)) {
      throw badRequest('items array is required');
    }

    const itemsInput = payload.items;

    await db.$transaction(async (tx) => {
      await tx.portfolioItem.deleteMany({ where: { userId: principal.userId } });

      for (const item of itemsInput) {
        if (typeof item.ticker !== 'string' || item.ticker.trim().length === 0 || typeof item.quantity !== 'number') {
          continue;
        }

        await tx.portfolioItem.create({
          data: {
            userId: principal.userId,
            ticker: item.ticker.toUpperCase(),
            quantity: item.quantity
          }
        });
      }
    });

    const items = await db.portfolioItem.findMany({ where: { userId: principal.userId }, orderBy: { updatedAt: 'desc' } });
    return c.json({
      items: items.map((item) => ({
        id: item.id,
        ticker: item.ticker,
        quantity: item.quantity,
        updatedAt: item.updatedAt.toISOString()
      }))
    });
  });

  return router;
}

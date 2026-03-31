import { Hono } from 'hono';

import { db } from '../lib/db.js';
import { badRequest, unauthorized } from '../lib/errors.js';
import type { AppEnv } from '../types/hono-context.js';

export function createKbRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/search', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized();
    }

    const query = c.req.query('q') ?? c.req.query('query') ?? '';
    if (query.trim().length === 0) {
      throw badRequest('query is required');
    }

    const entries = await db.kbEntry.findMany({
      where: {
        content: {
          contains: query,
          mode: 'insensitive'
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        ticker: true,
        entryType: true,
        content: true,
        updatedAt: true
      }
    });

    return c.json({
      results: entries.map((entry) => ({ ...entry, updatedAt: entry.updatedAt.toISOString() }))
    });
  });

  router.get('/thesis/:ticker', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized();
    }

    const ticker = c.req.param('ticker').toUpperCase();
    const entry = await db.kbEntry.findFirst({
      where: {
        ticker,
        entryType: 'thesis'
      },
      orderBy: { updatedAt: 'desc' }
    });

    return c.json({
      thesis: entry === null
        ? null
        : {
            id: entry.id,
            ticker: entry.ticker,
            content: entry.content,
            metadata: entry.metadata,
            updatedAt: entry.updatedAt.toISOString()
          }
    });
  });

  router.get('/history/:ticker', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized();
    }

    const ticker = c.req.param('ticker').toUpperCase();
    const snapshots = await db.kbThesisSnapshot.findMany({
      where: { ticker },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return c.json({
      history: snapshots.map((snapshot) => ({
        id: snapshot.id,
        ticker: snapshot.ticker,
        thesis: snapshot.thesis,
        confidence: snapshot.confidence,
        changeType: snapshot.changeType,
        changeSummary: snapshot.changeSummary,
        createdAt: snapshot.createdAt.toISOString()
      }))
    });
  });

  return router;
}

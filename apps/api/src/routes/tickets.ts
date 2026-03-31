import { Hono } from 'hono';

import { db } from '../lib/db.js';
import { badRequest, forbidden, unauthorized } from '../lib/errors.js';
import type { AppEnv } from '../types/hono-context.js';

type TicketState = 'pending_approval' | 'approved' | 'rejected' | 'expired' | 'cancelled';

function assertPending(status: TicketState): void {
  if (status !== 'pending_approval') {
    throw badRequest('Ticket is already finalized');
  }
}

export function createTicketsRouter(): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get('/', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized();
    }

    const tickets = await db.tradeTicket.findMany({
      where: {
        status: 'pending_approval',
        ...(principal.role === 'admin' ? {} : { userId: principal.userId })
      },
      orderBy: { createdAt: 'desc' }
    });

    return c.json({
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        ticker: ticket.ticker,
        action: ticket.action,
        quantity: ticket.quantity,
        confidence: ticket.confidence,
        status: ticket.status,
        rationale: ticket.rationale,
        expiresAt: ticket.expiresAt.toISOString(),
        createdAt: ticket.createdAt.toISOString()
      }))
    });
  });

  router.post('/:id/approve', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized();
    }
    if (principal.role !== 'admin') {
      throw forbidden();
    }

    const id = c.req.param('id');
    const existing = await db.tradeTicket.findUnique({ where: { id } });
    if (existing === null) {
      return c.json({ approved: false, reason: 'missing' }, 404);
    }

    assertPending(existing.status as TicketState);

    await db.tradeTicket.update({
      where: { id },
      data: {
        status: 'approved',
        approvedBy: principal.userId,
        approvedAt: new Date()
      }
    });

    return c.json({ approved: true });
  });

  router.post('/:id/reject', async (c) => {
    const principal = c.get('principal');
    if (principal === null) {
      throw unauthorized();
    }
    if (principal.role !== 'admin') {
      throw forbidden();
    }

    const id = c.req.param('id');
    const payload = (await c.req.json().catch(() => ({}))) as { reason?: string };

    const existing = await db.tradeTicket.findUnique({ where: { id } });
    if (existing === null) {
      return c.json({ rejected: false, reason: 'missing' }, 404);
    }

    assertPending(existing.status as TicketState);

    await db.tradeTicket.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectedBy: principal.userId,
        rejectionReason: payload.reason ?? 'Rejected by operator'
      }
    });

    return c.json({ rejected: true });
  });

  return router;
}

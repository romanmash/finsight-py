import { describe, expect, it, vi } from 'vitest';

import { runTicketExpiryCycle } from '../../workers/ticket-expiry-worker.js';

describe('runTicketExpiryCycle', () => {
  it('expires pending tickets up to now and returns affected count', async () => {
    const now = new Date('2026-03-31T12:00:00.000Z');
    const expirePendingTickets = vi.fn().mockResolvedValue(3);

    const count = await runTicketExpiryCycle({
      expirePendingTickets,
      now: () => now
    });

    expect(expirePendingTickets).toHaveBeenCalledWith(now);
    expect(count).toBe(3);
  });
});

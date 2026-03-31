import { TicketStatus } from '@finsight/shared-types';
import { Worker } from 'bullmq';

import { db } from '../lib/db.js';
import { getConfig } from '../lib/config.js';
import { logger } from '../lib/logger.js';
import { getBullMqConnectionOptions } from '../lib/redis.js';
import { buildWorkerOptions } from '../scheduler/init-scheduler.js';

interface TicketExpiryDependencies {
  expirePendingTickets: (cutoff: Date) => Promise<number>;
  now: () => Date;
}

const TICKET_EXPIRY_REASON = 'expired_by_scheduler';

function defaultDependencies(): TicketExpiryDependencies {
  return {
    expirePendingTickets: async (cutoff: Date): Promise<number> => {
      const result = await db.tradeTicket.updateMany({
        where: {
          status: TicketStatus.PENDING_APPROVAL,
          expiresAt: {
            lte: cutoff
          }
        },
        data: {
          status: TicketStatus.EXPIRED,
          rejectionReason: TICKET_EXPIRY_REASON
        }
      });

      return result.count;
    },
    now: () => new Date()
  };
}

export async function runTicketExpiryCycle(
  deps: TicketExpiryDependencies = defaultDependencies()
): Promise<number> {
  const cutoff = deps.now();
  const expiredCount = await deps.expirePendingTickets(cutoff);

  logger.info(
    {
      cutoff: cutoff.toISOString(),
      expiredCount
    },
    'Ticket expiry worker cycle executed'
  );

  return expiredCount;
}

export function createTicketExpiryWorker(): Worker<Record<string, unknown>> {
  const scheduler = getConfig().scheduler;

  return new Worker<Record<string, unknown>>(
    'ticketExpiry',
    async (): Promise<void> => {
      await runTicketExpiryCycle();
    },
    {
      connection: getBullMqConnectionOptions(),
      ...buildWorkerOptions(scheduler.ticketExpiry.concurrency)
    }
  );
}

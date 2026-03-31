import { Worker } from 'bullmq';

import { runManager } from '../agents/manager.js';
import { db } from '../lib/db.js';
import { getConfig } from '../lib/config.js';
import { getBullMqConnectionOptions } from '../lib/redis.js';
import { buildWorkerOptions } from '../scheduler/init-scheduler.js';

interface AlertPipelineJob {
  alertId: string;
}

export function createAlertPipelineWorker(): Worker<AlertPipelineJob> {
  const scheduler = getConfig().scheduler;

  return new Worker<AlertPipelineJob>(
    'alertPipeline',
    async (job): Promise<void> => {
      const alert = await db.alert.findUnique({ where: { id: job.data.alertId } });
      if (alert === null) {
        return;
      }

      await runManager({
        userId: alert.userId ?? undefined,
        missionType: 'alert_investigation',
        triggerType: 'alert',
        ticker: alert.ticker ?? undefined,
        message: alert.message,
        context: {
          instrument: alert.ticker ?? 'unknown',
          signalType: alert.alertType,
          triggerValue: alert.severity,
          thresholdValueOrEvent: alert.alertType,
          snapshotTimestamp: alert.createdAt.toISOString(),
          evidenceSummary: alert.message
        }
      });
    },
    {
      connection: getBullMqConnectionOptions(),
      ...buildWorkerOptions(scheduler.alertPipeline.concurrency)
    }
  );
}

import type { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';

import { botLogger } from './logger.js';

const DEDUP_TTL_SECONDS = 86400;

export interface PushTransport {
  sendMessage(chatId: string, message: string): Promise<void>;
}

export interface PushRequest {
  userId: string;
  message: string;
  correlationId?: string;
}

export interface PushResult {
  delivered: boolean;
  reason: 'sent' | 'skipped_no_chat' | 'send_failed' | 'duplicate';
}

export interface PushDispatcher {
  pushToUser(request: PushRequest): Promise<PushResult>;
}

export interface DeduplicationStore {
  isDuplicate(correlationId: string): Promise<boolean>;
  markSeen(correlationId: string, ttlSeconds: number): Promise<void>;
}

export function createRedisDeduplicationStore(redis: Pick<Redis, 'get' | 'set'>): DeduplicationStore {
  return {
    async isDuplicate(correlationId: string): Promise<boolean> {
      const key = `telegram:dedup:${correlationId}`;
      const existing = await redis.get(key);
      return existing !== null;
    },
    async markSeen(correlationId: string, ttlSeconds: number): Promise<void> {
      const key = `telegram:dedup:${correlationId}`;
      await redis.set(key, '1', 'EX', ttlSeconds);
    }
  };
}

export function createPushDispatcher(
  prisma: PrismaClient,
  transport: PushTransport,
  dedup?: DeduplicationStore
): PushDispatcher {
  return {
    async pushToUser(request: PushRequest): Promise<PushResult> {
      if (request.correlationId !== undefined && dedup !== undefined) {
        const isDuplicate = await dedup.isDuplicate(request.correlationId);
        if (isDuplicate) {
          return { delivered: false, reason: 'duplicate' };
        }

        await dedup.markSeen(request.correlationId, DEDUP_TTL_SECONDS);
      }

      const user = await prisma.user.findUnique({
        where: { id: request.userId },
        select: { telegramChatId: true }
      });

      if (user?.telegramChatId === null || user?.telegramChatId === undefined) {
        botLogger.warn({
          eventType: 'telegram_push_skipped',
          userId: request.userId,
          reasonCode: 'skipped_no_chat',
          correlationId: request.correlationId
        }, 'Skipping push because user has no telegramChatId');

        return { delivered: false, reason: 'skipped_no_chat' };
      }

      try {
        await transport.sendMessage(user.telegramChatId.toString(), request.message);
        return { delivered: true, reason: 'sent' };
      } catch (error) {
        botLogger.error({
          eventType: 'telegram_push_failed',
          userId: request.userId,
          reasonCode: 'send_failed',
          correlationId: request.correlationId,
          error: (error as Error).message
        }, 'Push delivery failed');
        return { delivered: false, reason: 'send_failed' };
      }
    }
  };
}

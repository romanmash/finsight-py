import { serve } from '@hono/node-server';
import { PrismaClient } from '@prisma/client';
import { Hono } from 'hono';
import { Redis } from 'ioredis';
import { Telegraf } from 'telegraf';
import { z } from 'zod';

import { createIdentityResolver } from './auth.js';
import { ApiClient } from './api-client.js';
import { loadBotEnv, loadTelegramRuntimeConfig } from './config.js';
import { handleIncomingMessage } from './handler.js';
import { botLogger } from './logger.js';
import { createPushDispatcher, createRedisDeduplicationStore } from './push.js';
import { createRedisRateLimiter } from './rate-limit.js';
import { createUserChatLinkStore } from './user-chat-link.js';

const pushPayloadSchema = z.object({
  userId: z.string().min(1),
  message: z.string().min(1),
  sourceType: z.enum(['alert', 'daily_brief', 'system']),
  missionId: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional()
});

async function main(): Promise<void> {
  const runtimeConfig = await loadTelegramRuntimeConfig();
  const env = loadBotEnv();

  const prisma = new PrismaClient();
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/0', {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableReadyCheck: true
  });
  await redis.connect();

  const bot = new Telegraf(env.telegramBotToken);
  const auth = createIdentityResolver(prisma);
  const rateLimiter = createRedisRateLimiter(redis, runtimeConfig.rateLimitPerUserPerMinute);
  const userChatLinkStore = createUserChatLinkStore(prisma);
  const dedupStore = createRedisDeduplicationStore(redis);
  const pushDispatcher = createPushDispatcher(prisma, {
    sendMessage: async (chatId: string, message: string): Promise<void> => {
      await bot.telegram.sendMessage(chatId, message);
    }
  }, dedupStore);

  bot.on('text', async (ctx) => {
    const incoming = {
      text: ctx.message.text,
      messageId: ctx.message.message_id,
      ...(ctx.from?.id !== undefined ? { fromId: ctx.from.id } : {}),
      ...(ctx.from?.username !== undefined ? { username: ctx.from.username } : {}),
      ...(ctx.chat?.id !== undefined ? { chatId: ctx.chat.id } : {})
    };

    const result = await handleIncomingMessage(incoming, {
      config: runtimeConfig,
      auth,
      rateLimiter,
      apiClientForUser: (_userId: string): ApiClient =>
        new ApiClient({
          baseUrl: env.apiBaseUrl,
          accessToken: env.apiAccessToken
        }),
      userChatLinkStore
    });

    for (const chunk of result.chunks) {
      await ctx.reply(chunk);
    }
  });

  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.post('/internal/push', async (c) => {
    const token = c.req.header('x-internal-token');
    if (token !== env.internalToken) {
      return c.json({ delivered: false, reason: 'unauthorized' }, 401);
    }

    const json = await c.req.json().catch(() => ({}));
    const parsed = pushPayloadSchema.safeParse(json);
    if (!parsed.success) {
      return c.json({ delivered: false, reason: 'validation_error' }, 400);
    }

    const request = {
      userId: parsed.data.userId,
      message: parsed.data.message,
      ...(parsed.data.correlationId !== undefined
        ? { correlationId: parsed.data.correlationId }
        : parsed.data.missionId !== undefined
          ? { correlationId: parsed.data.missionId }
          : {})
    };

    const result = await pushDispatcher.pushToUser(request);

    return c.json(result);
  });

  const port = Number(process.env.TELEGRAM_PORT ?? '3000');
  const server = serve({ fetch: app.fetch, port });

  await bot.launch();

  let shuttingDown = false;
  const onSignal = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    botLogger.info({ signal }, 'Shutting down telegram bot');
    bot.stop(signal);

    await Promise.race([
      Promise.all([redis.quit(), prisma.$disconnect()]),
      new Promise((resolve) => setTimeout(resolve, runtimeConfig.delivery.gracefulShutdownMs))
    ]);

    server.close();
    process.exit(0);
  };

  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    botLogger.error({ error: (error as Error).message }, 'Telegram bot startup failed');
    process.exit(1);
  });
}

export { main };

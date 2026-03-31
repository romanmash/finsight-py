import { describe, expect, it, vi } from 'vitest';

import { handleIncomingMessage } from '../handler.js';
import type { ApiClient } from '../api-client.js';
import type { TelegramConfigView } from '../types.js';

const config: TelegramConfigView = {
  rateLimitPerUserPerMinute: 10,
  commandBehavior: { allowFreeTextOperatorQuery: true, enabledCommands: { help: true } },
  responseMessages: {
    unauthorized: '⛔ Access denied.',
    throttled: '⏱ Rate limit exceeded. Please wait.',
    validationError: '⚠️ Invalid command. Use /help.',
    temporaryUnavailable: '⚠️ Service temporarily unavailable. Please try again.',
    internalFailure: '⚠️ Internal error. Please retry later.'
  },
  delivery: { messageMaxLength: 4096, gracefulShutdownMs: 10000 },
  performance: { acknowledgmentP95Ms: 3000 }
};

describe('handler chat-link persistence', () => {
  it('persists chat id on first successful interaction', async () => {
    const persist = vi.fn(async () => {});

    await handleIncomingMessage(
      { text: '/help', messageId: 1, fromId: 1, username: 'active', chatId: 555 },
      {
        config,
        auth: { resolveByUsername: async () => ({ userId: 'u1', role: 'analyst', telegramHandle: '@active', active: true, telegramChatId: null }) },
        rateLimiter: { consume: async () => true },
        apiClientForUser: () => ({}) as ApiClient,
        userChatLinkStore: { persistChatIdOnFirstSuccess: persist }
      }
    );

    expect(persist).toHaveBeenCalledWith('u1', 555);
  });
});


import { describe, expect, it } from 'vitest';

import { handleIncomingMessage } from '../handler.js';
import type { ApiClient } from '../api-client.js';
import type { TelegramConfigView } from '../types.js';

const config: TelegramConfigView = {
  rateLimitPerUserPerMinute: 10,
  commandBehavior: { allowFreeTextOperatorQuery: true, enabledCommands: {} },
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

describe('handler validation', () => {
  it('returns validation error for unsupported command text', async () => {
    const result = await handleIncomingMessage(
      { text: '/unknown', messageId: 1, fromId: 1, username: 'active', chatId: 2 },
      {
        config,
        auth: { resolveByUsername: async () => ({ userId: 'u1', role: 'analyst', telegramHandle: '@active', active: true, telegramChatId: null }) },
        rateLimiter: { consume: async () => true },
        apiClientForUser: () => ({}) as ApiClient,
        userChatLinkStore: { persistChatIdOnFirstSuccess: async () => {} }
      }
    );

    expect(result.chunks).toEqual(['⚠️ Invalid command. Use /help.']);
  });
});


import { describe, expect, it, vi } from 'vitest';

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

describe('handler free-text route', () => {
  it('routes non-command messages to chat API', async () => {
    const chat = vi.fn(async () => ({ response: 'ok', missionType: 'operator_query' }));

    const result = await handleIncomingMessage(
      { text: 'hello team', messageId: 1, fromId: 1, username: 'active', chatId: 2 },
      {
        config,
        auth: { resolveByUsername: async () => ({ userId: 'u1', role: 'analyst', telegramHandle: '@active', active: true, telegramChatId: null }) },
        rateLimiter: { consume: async () => true },
        apiClientForUser: () => ({ chat } as unknown as ApiClient),
        userChatLinkStore: { persistChatIdOnFirstSuccess: async () => {} }
      }
    );

    expect(chat).toHaveBeenCalledWith('hello team');
    expect(result.chunks[0]).toContain('Analysis');
  });
});


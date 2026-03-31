import { describe, expect, it, vi } from 'vitest';

import { handleIncomingMessage } from '../handler.js';
import type { ApiClient } from '../api-client.js';
import type { TelegramConfigView } from '../types.js';

const baseConfig: TelegramConfigView = {
  rateLimitPerUserPerMinute: 10,
  commandBehavior: {
    allowFreeTextOperatorQuery: true,
    enabledCommands: {
      screener_show_last: true
    }
  },
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

describe('command routing contract', () => {
  it('maps /screener show last to screener summary API', async () => {
    const screenerSummary = vi.fn(async () => ({ summary: { id: 'run-1' } }));

    const result = await handleIncomingMessage(
      { text: '/screener show last', messageId: 1, fromId: 1, username: 'active', chatId: 555 },
      {
        config: baseConfig,
        auth: { resolveByUsername: async () => ({ userId: 'u1', role: 'analyst', telegramHandle: '@active', active: true, telegramChatId: null }) },
        rateLimiter: { consume: async () => true },
        apiClientForUser: () => ({ screenerSummary } as unknown as ApiClient),
        userChatLinkStore: { persistChatIdOnFirstSuccess: async () => {} }
      }
    );

    expect(screenerSummary).toHaveBeenCalled();
    expect(result.chunks[0]).toContain('Screener');
  });
});


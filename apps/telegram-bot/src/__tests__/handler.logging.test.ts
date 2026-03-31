import { describe, expect, it, vi } from 'vitest';

import { handleIncomingMessage } from '../handler.js';
import { botLogger } from '../logger.js';
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

describe('handler logging', () => {
  it('logs denied access with required fields', async () => {
    const warn = vi.spyOn(botLogger, 'warn').mockImplementation(() => botLogger);

    await handleIncomingMessage(
      { text: '/help', messageId: 1, fromId: 1, username: 'ghost', chatId: 10 },
      {
        config,
        auth: { resolveByUsername: async () => null },
        rateLimiter: { consume: async () => true },
        apiClientForUser: () => {
          throw new Error('not used');
        },
        userChatLinkStore: { persistChatIdOnFirstSuccess: async () => {} }
      }
    );

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'telegram_auth_denied',
        telegramHandle: 'ghost',
        chatId: 10,
        reasonCode: 'unauthorized'
      }),
      expect.any(String)
    );
  });
});

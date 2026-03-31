import { describe, expect, it, vi } from 'vitest';

import { handleIncomingMessage } from '../handler.js';
import type { ApiClient } from '../api-client.js';
import type { TelegramConfigView } from '../types.js';

const config: TelegramConfigView = {
  rateLimitPerUserPerMinute: 10,
  commandBehavior: {
    allowFreeTextOperatorQuery: true,
    enabledCommands: {
      help: true,
      brief: true,
      pattern: true,
      compare: true,
      devil: true,
      thesis: true,
      history: true,
      screener_show_last: true,
      trade: true,
      approve: true,
      reject: true,
      alert: true,
      ack: true,
      watchlist: true,
      add: true,
      portfolio: true
    }
  },
  responseMessages: {
    unauthorized: '⛔ Access denied.',
    throttled: '⏱ Rate limit exceeded. Please wait.',
    validationError: '⚠️ Invalid command. Use /help.',
    temporaryUnavailable: '⚠️ Service temporarily unavailable. Please try again.',
    internalFailure: '⚠️ Internal error. Please retry later.'
  },
  delivery: {
    messageMaxLength: 4096,
    gracefulShutdownMs: 10000
  },
  performance: { acknowledgmentP95Ms: 3000 }
};

describe('handler auth and validation', () => {
  it('returns deterministic unauthorized response', async () => {
    const result = await handleIncomingMessage(
      { text: '/help', messageId: 1, fromId: 12, username: 'ghost', chatId: 55 },
      {
        config,
        auth: { resolveByUsername: async () => null },
        rateLimiter: { consume: async () => true },
        apiClientForUser: () => ({}) as ApiClient,
        userChatLinkStore: { persistChatIdOnFirstSuccess: async () => {} }
      }
    );

    expect(result.chunks).toEqual(['⛔ Access denied.']);
  });

  it('returns deterministic throttled response', async () => {
    const result = await handleIncomingMessage(
      { text: '/help', messageId: 1, fromId: 12, username: 'active', chatId: 55 },
      {
        config,
        auth: {
          resolveByUsername: async () => ({
            userId: 'u1',
            role: 'analyst',
            telegramHandle: '@active',
            active: true,
            telegramChatId: null
          })
        },
        rateLimiter: { consume: async () => false },
        apiClientForUser: () => ({}) as ApiClient,
        userChatLinkStore: { persistChatIdOnFirstSuccess: async () => {} }
      }
    );

    expect(result.chunks).toEqual(['⏱ Rate limit exceeded. Please wait.']);
  });

  it('rejects missing sender attributes as validation_error', async () => {
    const result = await handleIncomingMessage(
      { text: '/help', messageId: 1 },
      {
        config,
        auth: { resolveByUsername: async () => null },
        rateLimiter: { consume: async () => true },
        apiClientForUser: () => ({}) as ApiClient,
        userChatLinkStore: { persistChatIdOnFirstSuccess: async () => {} }
      }
    );

    expect(result.chunks).toEqual(['⚠️ Invalid command. Use /help.']);
  });

  it('routes free-text as operator query', async () => {
    const chat = vi.fn(async () => ({ response: 'handled', missionType: 'operator_query' }));
    const result = await handleIncomingMessage(
      { text: 'What changed today?', messageId: 1, fromId: 12, username: 'active', chatId: 55 },
      {
        config,
        auth: {
          resolveByUsername: async () => ({
            userId: 'u1',
            role: 'analyst',
            telegramHandle: '@active',
            active: true,
            telegramChatId: null
          })
        },
        rateLimiter: { consume: async () => true },
        apiClientForUser: () => ({ chat } as unknown as ApiClient),
        userChatLinkStore: { persistChatIdOnFirstSuccess: async () => {} }
      }
    );

    expect(chat).toHaveBeenCalledWith('What changed today?');
    expect(result.chunks[0]).toContain('📊 Analysis');
  });
});


import { describe, expect, it, vi } from 'vitest';

import { createPushDispatcher } from '../push.js';

describe('push dispatcher', () => {
  it('skips users without chat destination', async () => {
    const dispatcher = createPushDispatcher(
      {
        user: {
          findUnique: async () => ({ telegramChatId: null })
        }
      } as never,
      {
        sendMessage: async () => {}
      }
    );

    const result = await dispatcher.pushToUser({ userId: 'u1', message: 'hello' });
    expect(result).toEqual({ delivered: false, reason: 'skipped_no_chat' });
  });

  it('suppresses duplicate correlation attempts with dedup store', async () => {
    const sendMessage = vi.fn(async () => {});
    const seen = new Set<string>();

    const dispatcher = createPushDispatcher(
      {
        user: {
          findUnique: async () => ({ telegramChatId: BigInt(100) })
        }
      } as never,
      { sendMessage },
      {
        isDuplicate: async (id: string) => seen.has(id),
        markSeen: async (id: string) => {
          seen.add(id);
        }
      }
    );

    const first = await dispatcher.pushToUser({ userId: 'u1', message: 'hello', correlationId: 'c1' });
    const second = await dispatcher.pushToUser({ userId: 'u1', message: 'hello', correlationId: 'c1' });

    expect(first.delivered).toBe(true);
    expect(second).toEqual({ delivered: false, reason: 'duplicate' });
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('meets SC-005 proactive delivery threshold in controlled run', async () => {
    let attempt = 0;
    const dispatcher = createPushDispatcher(
      {
        user: {
          findUnique: async () => ({ telegramChatId: BigInt(100) })
        }
      } as never,
      {
        sendMessage: async () => {
          attempt += 1;
          if (attempt === 100) {
            throw new Error('single transport failure');
          }
        }
      }
    );

    const results = await Promise.all(
      Array.from({ length: 100 }).map((_x, idx) =>
        dispatcher.pushToUser({ userId: `u${idx}`, message: 'hello' })
      )
    );
    const delivered = results.filter((result) => result.delivered).length;
    const successRate = delivered / results.length;

    expect(successRate).toBeGreaterThanOrEqual(0.99);
  });
});

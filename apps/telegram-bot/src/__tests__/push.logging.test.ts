import { describe, expect, it, vi } from 'vitest';

import { createPushDispatcher } from '../push.js';
import { botLogger } from '../logger.js';

describe('push logging', () => {
  it('logs send failures with deterministic reason code', async () => {
    const error = vi.spyOn(botLogger, 'error').mockImplementation(() => botLogger);
    const dispatcher = createPushDispatcher(
      {
        user: {
          findUnique: async () => ({ telegramChatId: BigInt(100) })
        }
      } as never,
      {
        sendMessage: async () => {
          throw new Error('transport down');
        }
      }
    );

    const result = await dispatcher.pushToUser({ userId: 'u1', message: 'hello' });
    expect(result.reason).toBe('send_failed');
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'telegram_push_failed',
        userId: 'u1',
        reasonCode: 'send_failed'
      }),
      expect.any(String)
    );
  });
});

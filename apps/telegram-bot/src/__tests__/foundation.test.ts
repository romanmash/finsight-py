import { describe, expect, it } from 'vitest';

import { parseEnvelope, validateParsedCommand } from '../commands.js';
import { splitMessage } from '../formatter.js';
import { createRedisRateLimiter } from '../rate-limit.js';

describe('foundation primitives', () => {
  it('parses /screener show last as deterministic compatibility command', () => {
    const parsed = parseEnvelope('/screener show last');
    expect(parsed.parsedCommand?.command).toBe('screener_show_last');
    expect(validateParsedCommand(parsed.parsedCommand!)).toBeNull();
  });

  it('rejects invalid trade quantity', () => {
    const parsed = parseEnvelope('/trade AAPL buy -1');
    expect(parsed.parsedCommand).not.toBeNull();
    expect(validateParsedCommand(parsed.parsedCommand!)).not.toBeNull();
  });

  it('splits oversized messages in order', () => {
    const chunks = splitMessage('hello world '.repeat(500), 120);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ').length).toBeGreaterThan(1000);
  });

  it('enforces rate-limit per minute', async () => {
    const state = new Map<string, number>();
    const redis = {
      async incr(key: string): Promise<number> {
        const next = (state.get(key) ?? 0) + 1;
        state.set(key, next);
        return next;
      },
      async expire(_key: string, _seconds: number): Promise<number> {
        return 1;
      },
      async ttl(_key: string): Promise<number> {
        return 60;
      }
    };

    const limiter = createRedisRateLimiter(redis, 2);
    expect(await limiter.consume('u1')).toBe(true);
    expect(await limiter.consume('u1')).toBe(true);
    expect(await limiter.consume('u1')).toBe(false);
  });
});

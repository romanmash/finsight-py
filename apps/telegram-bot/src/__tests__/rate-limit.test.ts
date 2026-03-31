import { describe, expect, it } from 'vitest';

import { createRedisRateLimiter } from '../rate-limit.js';

describe('rate limiter', () => {
  it('recovers after reset simulation', async () => {
    let count = 0;
    const limiter = createRedisRateLimiter(
      {
        incr: async () => {
          count += 1;
          return count;
        },
        expire: async () => 1,
        ttl: async () => 60
      },
      1
    );

    expect(await limiter.consume('u1')).toBe(true);
    expect(await limiter.consume('u1')).toBe(false);

    count = 0;
    expect(await limiter.consume('u1')).toBe(true);
  });
});

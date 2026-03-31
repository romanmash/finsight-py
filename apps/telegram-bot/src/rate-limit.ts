export interface RedisRateLimitStore {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
}

export interface RateLimiter {
  consume(userId: string): Promise<boolean>;
}

export function createRedisRateLimiter(redis: RedisRateLimitStore, limitPerMinute: number): RateLimiter {
  return {
    async consume(userId: string): Promise<boolean> {
      const key = `telegram:rate-limit:${userId}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, 60);
      }

      const ttl = await redis.ttl(key);
      if (ttl < 0) {
        await redis.expire(key, 60);
      }

      return count <= limitPerMinute;
    }
  };
}

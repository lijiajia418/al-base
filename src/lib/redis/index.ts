import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// 懒连接：构建阶段不创建连接，运行时首次使用才连接
let _redis: Redis | null = null;

export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    if (!_redis) {
      _redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
      });
      _redis.connect().catch(() => {});
    }
    return (_redis as any)[prop];
  },
});

export async function setKey(key: string, value: string, ttlSeconds: number): Promise<void> {
  await redis.set(key, value, "EX", ttlSeconds);
}

export async function getKey(key: string): Promise<string | null> {
  return redis.get(key);
}

export async function delKey(key: string): Promise<void> {
  await redis.del(key);
}

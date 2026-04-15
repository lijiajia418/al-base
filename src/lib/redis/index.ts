import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(redisUrl);

export async function setKey(key: string, value: string, ttlSeconds: number): Promise<void> {
  await redis.set(key, value, "EX", ttlSeconds);
}

export async function getKey(key: string): Promise<string | null> {
  return redis.get(key);
}

export async function delKey(key: string): Promise<void> {
  await redis.del(key);
}

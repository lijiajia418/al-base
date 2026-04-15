import { describe, it, expect, afterAll } from "vitest";
import { redis, setKey, getKey, delKey } from "@/lib/redis";

describe("Redis Client", () => {
  afterAll(async () => {
    await redis.quit();
  });

  it("should set, get and delete a key correctly", async () => {
    const key = "test:redis-client";
    const value = "hello-redis";

    // set
    await setKey(key, value, 60);

    // get
    const result = await getKey(key);
    expect(result).toBe(value);

    // del
    await delKey(key);
    const deleted = await getKey(key);
    expect(deleted).toBeNull();
  });
});

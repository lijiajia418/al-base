import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { redis } from "@/lib/redis";
import { POST } from "@/app/api/v1/auth/sms-code/route";

describe("POST /api/v1/auth/sms-code", () => {
  const testPhone = "13800002222";

  beforeEach(async () => {
    await redis.del(`sms:code:${testPhone}`);
    await redis.del(`sms:cooldown:${testPhone}`);
    await redis.del(`sms:limit:${testPhone}`);
    await redis.del(`sms:lock:${testPhone}`);
  });

  afterAll(async () => {
    await redis.del(`sms:code:${testPhone}`);
    await redis.del(`sms:cooldown:${testPhone}`);
    await redis.del(`sms:limit:${testPhone}`);
    await redis.del(`sms:lock:${testPhone}`);
    await redis.quit();
  });

  it("should return cooldown for valid phone number", async () => {
    const req = new Request("http://localhost:3000/api/v1/auth/sms-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: testPhone }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.cooldown).toBe(60);
  });

  it("should reject invalid phone format", async () => {
    const req = new Request("http://localhost:3000/api/v1/auth/sms-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "123" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe(40001);
  });
});

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { schools } from "@/db/schema/schools";
import { eq } from "drizzle-orm";
import { SmsService } from "@/domains/auth/sms-service";
import { POST } from "@/app/api/v1/auth/login/route";

describe("POST /api/v1/auth/login", () => {
  const smsService = new SmsService();
  const testPhone = "13800003333";
  const testSchoolId = "00000000-0000-0000-0000-000000000099";

  beforeEach(async () => {
    await redis.del(`sms:code:${testPhone}`);
    await redis.del(`sms:cooldown:${testPhone}`);
    await redis.del(`sms:limit:${testPhone}`);
    await redis.del(`sms:lock:${testPhone}`);
    await db.delete(users).where(eq(users.phone, testPhone));
  });

  afterAll(async () => {
    await redis.del(`sms:code:${testPhone}`);
    await redis.del(`sms:cooldown:${testPhone}`);
    await redis.del(`sms:limit:${testPhone}`);
    await redis.del(`sms:lock:${testPhone}`);
    await db.delete(users).where(eq(users.phone, testPhone));
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await redis.quit();
  });

  it("should login with valid code and return token + user", async () => {
    // 准备：创建测试学校（login 需要 defaultSchoolId）
    await db.insert(schools).values({
      id: testSchoolId,
      name: "登录测试学校",
      code: "LOGIN-TEST",
    }).onConflictDoNothing();

    // 1. 发送验证码
    await smsService.sendCode(testPhone);
    const stored = await redis.get(`sms:code:${testPhone}`);
    const { code } = JSON.parse(stored!);

    // 2. 调用登录 API
    const req = new Request("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: testPhone, code }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.token).toBeTruthy();
    expect(body.data.user.phone).toBe(testPhone);
    expect(body.data.isNewUser).toBe(true);

    // 清理 session
    if (body.data.token) {
      await redis.del(`session:${body.data.token}`);
    }
  });

  it("should reject with wrong code", async () => {
    await smsService.sendCode(testPhone);

    const req = new Request("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: testPhone, code: "000000" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.code).toBe(40103);
  });
});

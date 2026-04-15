import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { eq } from "drizzle-orm";
import { AuthService } from "@/domains/auth/auth-service";
import { SmsService } from "@/domains/auth/sms-service";

describe("AuthService", () => {
  const smsService = new SmsService();
  const authService = new AuthService();
  const testPhone = "13800009999";

  beforeEach(async () => {
    // 清理测试数据
    await redis.del(`sms:code:${testPhone}`);
    await redis.del(`sms:cooldown:${testPhone}`);
    await redis.del(`sms:limit:${testPhone}`);
    await redis.del(`sms:lock:${testPhone}`);
    // 清理测试用户
    await db.delete(users).where(eq(users.phone, testPhone));
  });

  afterAll(async () => {
    await redis.del(`sms:code:${testPhone}`);
    await redis.del(`sms:cooldown:${testPhone}`);
    await redis.del(`sms:limit:${testPhone}`);
    await redis.del(`sms:lock:${testPhone}`);
    await db.delete(users).where(eq(users.phone, testPhone));
    await redis.quit();
  });

  it("should login with valid code and new phone, creating user and returning token", async () => {
    // 1. 发送验证码
    await smsService.sendCode(testPhone);

    // 2. 从 Redis 获取实际验证码
    const stored = await redis.get(`sms:code:${testPhone}`);
    const { code } = JSON.parse(stored!);

    // 3. 需要一个 schoolId，先查或创建测试学校
    // 为了测试简单，直接传一个固定的 schoolId
    const testSchoolId = "00000000-0000-0000-0000-000000000001";

    // 4. 登录
    const result = await authService.login(testPhone, code, testSchoolId);

    expect(result.success).toBe(true);
    expect(result.token).toBeTruthy();
    expect(result.user).toBeTruthy();
    expect(result.user!.phone).toBe(testPhone);
    expect(result.user!.roles).toEqual([]);
    expect(result.isNewUser).toBe(true);

    // 5. 清理 session
    if (result.token) {
      await redis.del(`session:${result.token}`);
    }
  });
});

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import { SmsService } from "@/domains/auth/sms-service";

describe("SmsService", () => {
  const smsService = new SmsService();
  const testPhone = "13800001111";

  beforeEach(async () => {
    // 清理测试数据
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

  it("should send code then verify successfully, and code is consumed after use", async () => {
    // 发送验证码
    const result = await smsService.sendCode(testPhone);
    expect(result.success).toBe(true);
    expect(result.cooldown).toBe(60);

    // 从 Redis 读取实际验证码（测试用）
    const stored = await redis.get(`sms:code:${testPhone}`);
    const { code } = JSON.parse(stored!);

    // 校验通过
    const verifyResult = await smsService.verifyCode(testPhone, code);
    expect(verifyResult.success).toBe(true);

    // 码已消耗，再次校验失败
    const reVerify = await smsService.verifyCode(testPhone, code);
    expect(reVerify.success).toBe(false);
  });
});

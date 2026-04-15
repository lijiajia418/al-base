import { redis } from "@/lib/redis";

const SMS_CODE_TTL = 300;        // 5 分钟
const SMS_COOLDOWN_TTL = 60;     // 60 秒冷却
const SMS_DAILY_LIMIT = 10;      // 每日上限
const SMS_LOCK_TTL = 1800;       // 锁定 30 分钟
const SMS_MAX_ATTEMPTS = 5;      // 最大验证失败次数

interface SendCodeResult {
  success: boolean;
  cooldown?: number;
  error?: string;
}

interface VerifyCodeResult {
  success: boolean;
  error?: string;
}

export class SmsService {
  async sendCode(phone: string): Promise<SendCodeResult> {
    // 检查锁定
    const locked = await redis.get(`sms:lock:${phone}`);
    if (locked) {
      return { success: false, error: "SMS_LOCKED" };
    }

    // 检查冷却
    const cooldown = await redis.get(`sms:cooldown:${phone}`);
    if (cooldown) {
      return { success: false, error: "SMS_COOLDOWN" };
    }

    // 检查每日限制
    const dailyCount = await redis.get(`sms:limit:${phone}`);
    if (dailyCount && parseInt(dailyCount) >= SMS_DAILY_LIMIT) {
      return { success: false, error: "SMS_DAILY_LIMIT" };
    }

    // 生成 6 位随机码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 存储验证码
    await redis.set(
      `sms:code:${phone}`,
      JSON.stringify({ code, attempts: 0 }),
      "EX",
      SMS_CODE_TTL
    );

    // 设置冷却
    await redis.set(`sms:cooldown:${phone}`, "1", "EX", SMS_COOLDOWN_TTL);

    // 递增每日计数
    const limitKey = `sms:limit:${phone}`;
    await redis.incr(limitKey);
    // 设置过期到当日结束
    const ttl = await redis.ttl(limitKey);
    if (ttl === -1) {
      const now = new Date();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const secondsLeft = Math.floor((endOfDay.getTime() - now.getTime()) / 1000);
      await redis.expire(limitKey, secondsLeft);
    }

    // MVP: console.log 模拟发送，后续对接阿里云 SMS
    console.log(`[SMS] 验证码已发送到 ${phone}: ${code}`);

    return { success: true, cooldown: SMS_COOLDOWN_TTL };
  }

  async verifyCode(phone: string, code: string): Promise<VerifyCodeResult> {
    // 检查锁定
    const locked = await redis.get(`sms:lock:${phone}`);
    if (locked) {
      return { success: false, error: "SMS_LOCKED" };
    }

    // 读取验证码
    const stored = await redis.get(`sms:code:${phone}`);
    if (!stored) {
      return { success: false, error: "CODE_EXPIRED" };
    }

    let data: { code: string; attempts: number };
    try {
      data = JSON.parse(stored);
    } catch {
      await redis.del(`sms:code:${phone}`);
      return { success: false, error: "CODE_EXPIRED" };
    }

    // 检查尝试次数
    if (data.attempts >= SMS_MAX_ATTEMPTS) {
      await redis.set(`sms:lock:${phone}`, "1", "EX", SMS_LOCK_TTL);
      await redis.del(`sms:code:${phone}`);
      return { success: false, error: "SMS_LOCKED" };
    }

    // 校验验证码
    if (data.code !== code) {
      data.attempts += 1;
      await redis.set(
        `sms:code:${phone}`,
        JSON.stringify(data),
        "KEEPTTL"
      );
      return { success: false, error: "WRONG_CODE" };
    }

    // 验证成功，删除验证码（一次性使用）
    await redis.del(`sms:code:${phone}`);

    return { success: true };
  }
}

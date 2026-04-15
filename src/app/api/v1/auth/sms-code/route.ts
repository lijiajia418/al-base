import { SmsService } from "@/domains/auth/sms-service";
import { success, error, ErrorCode, type ErrorCodeValue } from "@/lib/api/response";

const smsService = new SmsService();

export async function POST(req: Request) {
  const body = await req.json();
  const { phone } = body;

  // 校验手机号格式（11位数字）
  if (!phone || !/^\d{11}$/.test(phone)) {
    return Response.json(
      error(ErrorCode.PHONE_FORMAT_ERROR, "手机号格式错误"),
      { status: 400 }
    );
  }

  const result = await smsService.sendCode(phone);

  if (!result.success) {
    const errorMap: Record<string, { code: ErrorCodeValue; status: number; message: string }> = {
      SMS_LOCKED: { code: ErrorCode.SMS_LOCKED, status: 429, message: "手机号已被锁定，请稍后再试" },
      SMS_COOLDOWN: { code: ErrorCode.SMS_COOLDOWN, status: 429, message: "发送过于频繁，请稍后再试" },
      SMS_DAILY_LIMIT: { code: ErrorCode.SMS_DAILY_LIMIT, status: 429, message: "今日发送次数已达上限" },
    };

    const err = errorMap[result.error!] || { code: ErrorCode.SMS_SEND_FAILED, status: 500, message: "发送失败" };
    return Response.json(error(err.code, err.message), { status: err.status });
  }

  return Response.json(success({ cooldown: result.cooldown }));
}

import { AuthService } from "@/domains/auth/auth-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const authService = new AuthService();

// 默认学校 ID（MVP：运营初始化的学校，新用户默认归属）
const DEFAULT_SCHOOL_ID = process.env.DEFAULT_SCHOOL_ID || "00000000-0000-0000-0000-000000000099";

export async function POST(req: Request) {
  const body = await req.json();
  const { phone, code } = body;

  if (!phone || !/^\d{11}$/.test(phone)) {
    return Response.json(
      error(ErrorCode.PHONE_FORMAT_ERROR, "手机号格式错误"),
      { status: 400 }
    );
  }

  if (!code) {
    return Response.json(
      error(ErrorCode.INVALID_PARAMS, "验证码不能为空"),
      { status: 400 }
    );
  }

  const result = await authService.login(phone, code, DEFAULT_SCHOOL_ID);

  if (!result.success) {
    const errorMap: Record<string, { code: number; status: number; message: string }> = {
      WRONG_CODE: { code: ErrorCode.WRONG_CODE, status: 401, message: "验证码错误" },
      CODE_EXPIRED: { code: ErrorCode.CODE_EXPIRED, status: 401, message: "验证码已过期" },
      SMS_LOCKED: { code: ErrorCode.SMS_LOCKED, status: 429, message: "验证失败次数过多，请稍后再试" },
      ACCOUNT_SUSPENDED: { code: ErrorCode.ACCOUNT_SUSPENDED, status: 403, message: "账号已被停用" },
    };

    const err = errorMap[result.error!] || { code: ErrorCode.INTERNAL_ERROR, status: 500, message: "登录失败" };
    return Response.json(error(err.code, err.message), { status: err.status });
  }

  return Response.json(
    success({
      token: result.token,
      user: result.user,
      isNewUser: result.isNewUser,
    })
  );
}

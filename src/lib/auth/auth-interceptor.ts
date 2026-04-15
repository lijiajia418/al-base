import { NextRequest } from "next/server";
import { TokenService } from "@/domains/auth/token-service";
import { error, ErrorCode } from "@/lib/api/response";

export interface AuthContext {
  userId: string;
  phone: string;
  roles: string[];
  schoolId: string;
  activeRole: string;
}

type AuthHandler = (req: NextRequest, auth: AuthContext) => Promise<Response>;

const tokenService = new TokenService();

/**
 * 高阶函数：包装 route handler，自动验证 Token 并注入 AuthContext。
 * 用法：export const GET = withAuth(async (req, auth) => { ... })
 */
export function withAuth(handler: AuthHandler) {
  return async (req: NextRequest): Promise<Response> => {
    // 1. 提取 Token
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return Response.json(
        error(ErrorCode.NO_TOKEN, "未提供认证令牌"),
        { status: 401 }
      );
    }

    const token = authHeader.slice(7); // "Bearer ".length === 7

    // 2. 查 Redis session
    const session = await tokenService.getSession(token);
    if (!session) {
      return Response.json(
        error(ErrorCode.TOKEN_EXPIRED, "令牌已过期或无效"),
        { status: 401 }
      );
    }

    // 3. 构建 AuthContext
    const auth: AuthContext = {
      userId: session.userId,
      phone: session.phone,
      roles: session.roles,
      schoolId: session.schoolId,
      activeRole: session.activeRole,
    };

    // 4. 执行业务 handler
    return handler(req, auth);
  };
}

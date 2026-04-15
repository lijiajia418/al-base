import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/auth-interceptor";
import { AuthService } from "@/domains/auth/auth-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const authService = new AuthService();

export const POST = withAuth(async (req, auth) => {
  const body = await req.json();
  const { role } = body;

  if (!role) {
    return Response.json(
      error(ErrorCode.INVALID_PARAMS, "角色不能为空"),
      { status: 400 }
    );
  }

  const token = req.headers.get("authorization")!.replace("Bearer ", "");
  const result = await authService.switchRole(token, role);

  if (!result.success) {
    if (result.error === "ROLE_NOT_ASSIGNED") {
      return Response.json(
        error(ErrorCode.ROLE_NOT_ASSIGNED, "您不拥有该角色"),
        { status: 403 }
      );
    }
    return Response.json(
      error(ErrorCode.TOKEN_EXPIRED, "令牌已过期"),
      { status: 401 }
    );
  }

  return Response.json(success({ activeRole: role }));
});

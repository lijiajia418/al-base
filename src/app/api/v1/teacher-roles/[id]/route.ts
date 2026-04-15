import { withAuth } from "@/lib/auth/auth-interceptor";
import { RolePermissionService } from "@/domains/permission/role-permission-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const rpService = new RolePermissionService();

export const GET = withAuth(async (req, auth) => {
  if (auth.activeRole !== "school_admin") {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "仅管理员可访问"), { status: 403 });
  }
  const id = req.nextUrl.pathname.split("/").pop()!;
  const role = await rpService.getRole(id);
  if (!role) return Response.json(error(ErrorCode.ROLE_NOT_FOUND, "角色不存在"), { status: 404 });
  return Response.json(success(role));
});

export const PUT = withAuth(async (req, auth) => {
  if (auth.activeRole !== "school_admin") {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "仅管理员可访问"), { status: 403 });
  }
  const id = req.nextUrl.pathname.split("/").pop()!;
  const body = await req.json();
  const updated = await rpService.updateRole(id, body);
  return Response.json(success(updated));
});

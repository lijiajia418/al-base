import { withAuth } from "@/lib/auth/auth-interceptor";
import { RolePermissionService } from "@/domains/permission/role-permission-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const rpService = new RolePermissionService();

export const GET = withAuth(async (req, auth) => {
  if (auth.activeRole !== "school_admin") {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "仅管理员可访问"), { status: 403 });
  }
  const perms = await rpService.listPermissions();
  return Response.json(success(perms));
});

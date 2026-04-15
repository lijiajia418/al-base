import { withAuth } from "@/lib/auth/auth-interceptor";
import { RolePermissionService } from "@/domains/permission/role-permission-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const rpService = new RolePermissionService();

export const PUT = withAuth(async (req, auth) => {
  if (auth.activeRole !== "school_admin") {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "仅管理员可访问"), { status: 403 });
  }
  const segments = req.nextUrl.pathname.split("/");
  const roleId = segments[segments.indexOf("teacher-roles") + 1];
  const body = await req.json();
  await rpService.setPermissions(roleId, body.permissionIds || []);
  return Response.json(success(null));
});

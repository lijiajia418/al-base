import { withAuth } from "@/lib/auth/auth-interceptor";
import { RolePermissionService } from "@/domains/permission/role-permission-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const rpService = new RolePermissionService();

export const GET = withAuth(async (req, auth) => {
  if (auth.activeRole !== "school_admin") {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "仅管理员可访问"), { status: 403 });
  }
  const roles = await rpService.listRoles(auth.schoolId);
  return Response.json(success(roles));
});

export const POST = withAuth(async (req, auth) => {
  if (auth.activeRole !== "school_admin") {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "仅管理员可访问"), { status: 403 });
  }
  const body = await req.json();
  const { name, code, description, permissionIds } = body;

  if (!name || !code) {
    return Response.json(error(ErrorCode.INVALID_PARAMS, "名称和编码不能为空"), { status: 400 });
  }

  const role = await rpService.createRole(auth.schoolId, { name, code, description });
  if (!role) {
    return Response.json(error(ErrorCode.ROLE_CODE_EXISTS, "角色编码已存在"), { status: 409 });
  }

  if (permissionIds?.length) {
    await rpService.setPermissions(role.id, permissionIds);
  }

  return Response.json(success(role));
});

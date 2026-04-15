import type { AuthContext } from "./auth-interceptor";

interface RoleResolveResult {
  success: boolean;
  activeRole?: string;
  error?: string;
}

/**
 * 解析当前请求应使用的角色视角。
 *
 * 优先级：
 *   1. requestedRole（来自 X-Active-Role header）
 *   2. auth.activeRole（session 中的上次选择）
 *   3. auth.roles[0]（默认第一个角色）
 *
 * 校验：最终角色必须在 user.roles 中，否则拒绝。
 */
export function resolveActiveRole(
  auth: AuthContext,
  requestedRole: string | undefined
): RoleResolveResult {
  // 确定候选角色
  let role = requestedRole || auth.activeRole || auth.roles[0] || "";

  if (!role) {
    return { success: false, error: "ROLE_NOT_ASSIGNED" };
  }

  // 校验角色是否在用户角色列表中
  if (!auth.roles.includes(role)) {
    return { success: false, error: "ROLE_NOT_ASSIGNED" };
  }

  return { success: true, activeRole: role };
}

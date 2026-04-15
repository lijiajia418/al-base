import { db } from "@/db";
import { teacherRolePermissions } from "@/db/schema/teacher-role-permissions";
import { permissions } from "@/db/schema/permissions";
import { eq, and } from "drizzle-orm";
import type { AuthContext } from "./auth-interceptor";

// ─────────────────────────────────────────────
// 第一层：身份角色检查（代码路由映射）
// ─────────────────────────────────────────────

interface IdentityCheckResult {
  allowed: boolean;
}

/**
 * 检查当前用户的 activeRole 是否在允许的角色列表中。
 */
export function checkIdentityRole(
  auth: AuthContext,
  allowedRoles: string[]
): IdentityCheckResult {
  return { allowed: allowedRoles.includes(auth.activeRole) };
}

// ─────────────────────────────────────────────
// 第二层：teacher 职能权限检查（查数据库）
// ─────────────────────────────────────────────

/**
 * 检查指定的 teacher_role 是否拥有某个权限。
 *
 * @param teacherRoleId - teacher_roles.id（来自 teacher_profiles 或 class_teachers）
 * @param permissionCode - 权限编码（如 "task:assign"）
 * @returns true = 有权限，false = 无权限
 */
export async function checkTeacherPermission(
  teacherRoleId: string | null | undefined,
  permissionCode: string
): Promise<boolean> {
  if (!teacherRoleId) return false;

  // 查 permissions 表获取 permission_id
  const [perm] = await db
    .select({ id: permissions.id })
    .from(permissions)
    .where(eq(permissions.code, permissionCode))
    .limit(1);

  if (!perm) return false;

  // 查 teacher_role_permissions 表
  const [mapping] = await db
    .select({ id: teacherRolePermissions.id })
    .from(teacherRolePermissions)
    .where(
      and(
        eq(teacherRolePermissions.teacherRoleId, teacherRoleId),
        eq(teacherRolePermissions.permissionId, perm.id)
      )
    )
    .limit(1);

  return !!mapping;
}

// ─────────────────────────────────────────────
// 第三层：资源归属校验辅助函数
// ─────────────────────────────────────────────

// 以下辅助函数在各 Service 中使用，这里仅导出类型和工具函数

/**
 * 校验老师是否属于某个班级（通过 class_teachers 关系）。
 * 具体实现在 ClassService 中，这里预留接口。
 */
export async function checkTeacherClassAccess(
  teacherId: string,
  classId: string
): Promise<boolean> {
  const { classTeachers } = await import("@/db/schema/class-teachers");
  const [record] = await db
    .select({ id: classTeachers.id })
    .from(classTeachers)
    .where(
      and(
        eq(classTeachers.teacherId, teacherId),
        eq(classTeachers.classId, classId)
      )
    )
    .limit(1);

  return !!record;
}

/**
 * 校验家长是否绑定了某个学生（通过 parent_student_relations）。
 */
export async function checkParentStudentAccess(
  parentId: string,
  studentId: string
): Promise<boolean> {
  const { parentStudentRelations } = await import("@/db/schema/parent-student-relations");
  const [record] = await db
    .select({ id: parentStudentRelations.id })
    .from(parentStudentRelations)
    .where(
      and(
        eq(parentStudentRelations.parentId, parentId),
        eq(parentStudentRelations.studentId, studentId),
        eq(parentStudentRelations.bindingStatus, "active")
      )
    )
    .limit(1);

  return !!record;
}

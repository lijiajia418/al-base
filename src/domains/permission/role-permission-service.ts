import { db } from "@/db";
import { teacherRoles } from "@/db/schema/teacher-roles";
import { permissions } from "@/db/schema/permissions";
import { teacherRolePermissions } from "@/db/schema/teacher-role-permissions";
import { teacherProfiles } from "@/db/schema/teacher-profiles";
import { eq, and, sql } from "drizzle-orm";

interface CreateRoleParams {
  name: string;
  code: string;
  description?: string;
}

export class RolePermissionService {
  async createRole(schoolId: string, params: CreateRoleParams) {
    // 检查 school+code 唯一
    const [existing] = await db.select().from(teacherRoles)
      .where(and(eq(teacherRoles.schoolId, schoolId), eq(teacherRoles.code, params.code)));
    if (existing) return null; // ROLE_CODE_EXISTS

    const [role] = await db.insert(teacherRoles).values({
      schoolId,
      name: params.name,
      code: params.code,
      description: params.description ?? null,
    }).returning();

    return role;
  }

  async listRoles(schoolId: string) {
    const roles = await db.select().from(teacherRoles).where(eq(teacherRoles.schoolId, schoolId));

    // 补充 teacherCount 和 permissionCount
    const result = await Promise.all(roles.map(async (role) => {
      const [permCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(teacherRolePermissions)
        .where(eq(teacherRolePermissions.teacherRoleId, role.id));

      const [teacherCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(teacherProfiles)
        .where(eq(teacherProfiles.teacherRoleId, role.id));

      return {
        ...role,
        permissionCount: permCount?.count ?? 0,
        teacherCount: teacherCount?.count ?? 0,
      };
    }));

    return result;
  }

  async getRole(roleId: string, schoolId?: string) {
    const conditions = [eq(teacherRoles.id, roleId)];
    if (schoolId) conditions.push(eq(teacherRoles.schoolId, schoolId));

    const [role] = await db.select().from(teacherRoles).where(and(...conditions));
    if (!role) return null;

    const rolePerms = await db
      .select({
        id: permissions.id,
        code: permissions.code,
        name: permissions.name,
        scope: permissions.scope,
        category: permissions.category,
      })
      .from(teacherRolePermissions)
      .innerJoin(permissions, eq(teacherRolePermissions.permissionId, permissions.id))
      .where(eq(teacherRolePermissions.teacherRoleId, roleId));

    return { ...role, permissions: rolePerms };
  }

  async updateRole(roleId: string, data: { name?: string; description?: string; status?: string }) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.status !== undefined) updates.status = data.status;

    const [updated] = await db.update(teacherRoles).set(updates).where(eq(teacherRoles.id, roleId)).returning();
    return updated ?? null;
  }

  async setPermissions(roleId: string, permissionIds: string[]) {
    // 全量替换
    await db.delete(teacherRolePermissions).where(eq(teacherRolePermissions.teacherRoleId, roleId));

    if (permissionIds.length > 0) {
      await db.insert(teacherRolePermissions).values(
        permissionIds.map((pid) => ({
          teacherRoleId: roleId,
          permissionId: pid,
        }))
      );
    }
  }

  async listPermissions() {
    return db.select().from(permissions).orderBy(permissions.sortOrder);
  }
}

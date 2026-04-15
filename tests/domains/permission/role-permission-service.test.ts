import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db";
import { schools } from "@/db/schema/schools";
import { permissions } from "@/db/schema/permissions";
import { teacherRoles } from "@/db/schema/teacher-roles";
import { teacherRolePermissions } from "@/db/schema/teacher-role-permissions";
import { eq } from "drizzle-orm";
import { redis } from "@/lib/redis";
import { RolePermissionService } from "@/domains/permission/role-permission-service";

describe("RolePermissionService", () => {
  const rpService = new RolePermissionService();
  const testSchoolId = "00000000-0000-0000-0000-b00000000006";
  let createdRoleId: string;

  beforeAll(async () => {
    await db.insert(schools).values({ id: testSchoolId, name: "权限服务测试校", code: "RPS-SVC-001" }).onConflictDoNothing();
  });

  afterAll(async () => {
    if (createdRoleId) {
      await db.delete(teacherRolePermissions).where(eq(teacherRolePermissions.teacherRoleId, createdRoleId));
      await db.delete(teacherRoles).where(eq(teacherRoles.id, createdRoleId));
    }
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await redis.quit();
  });

  it("should create role, assign permissions, and query back correctly", async () => {
    // 1. 创建角色
    const role = await rpService.createRole(testSchoolId, {
      name: "测试主讲",
      code: "test-instructor",
      description: "测试用主讲角色",
    });
    expect(role).toBeTruthy();
    createdRoleId = role!.id;

    // 2. 获取权限列表
    const allPerms = await rpService.listPermissions();
    expect(allPerms.length).toBeGreaterThanOrEqual(14);

    // 3. 分配权限（选 class:create 和 task:assign）
    const classCreateId = allPerms.find((p) => p.code === "class:create")!.id;
    const taskAssignId = allPerms.find((p) => p.code === "task:assign")!.id;

    await rpService.setPermissions(createdRoleId, [classCreateId, taskAssignId]);

    // 4. 查询角色详情
    const detail = await rpService.getRole(createdRoleId);
    expect(detail).toBeTruthy();
    expect(detail!.permissions.length).toBe(2);
    expect(detail!.permissions.map((p) => p.code)).toContain("class:create");
    expect(detail!.permissions.map((p) => p.code)).toContain("task:assign");
  });
});

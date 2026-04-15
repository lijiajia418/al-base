import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import { db } from "@/db";
import { schools } from "@/db/schema/schools";
import { users } from "@/db/schema/users";
import { teacherProfiles } from "@/db/schema/teacher-profiles";
import { teacherRoles } from "@/db/schema/teacher-roles";
import { permissions } from "@/db/schema/permissions";
import { teacherRolePermissions } from "@/db/schema/teacher-role-permissions";
import { eq } from "drizzle-orm";
import {
  checkIdentityRole,
  checkTeacherPermission,
} from "@/lib/auth/permission-guard";
import type { AuthContext } from "@/lib/auth/auth-interceptor";

describe("PermissionGuard", () => {
  const testSchoolId = "00000000-0000-0000-0000-a00000000001";
  let instructorRoleId: string;
  let assistantRoleId: string;
  let classCreatePermId: string;
  let taskAssignPermId: string;

  beforeAll(async () => {
    // 创建测试学校
    await db.insert(schools).values({
      id: testSchoolId,
      name: "权限测试学校",
      code: "PG-TEST-001",
    }).onConflictDoNothing();

    // 获取权限 ID（由种子数据预置）
    const perms = await db.select().from(permissions);
    classCreatePermId = perms.find((p) => p.code === "class:create")!.id;
    taskAssignPermId = perms.find((p) => p.code === "task:assign")!.id;

    // 创建主讲老师角色（有 class:create + task:assign）
    const [instructor] = await db
      .insert(teacherRoles)
      .values({ schoolId: testSchoolId, name: "主讲老师", code: "instructor" })
      .returning();
    instructorRoleId = instructor.id;

    await db.insert(teacherRolePermissions).values([
      { teacherRoleId: instructorRoleId, permissionId: classCreatePermId },
      { teacherRoleId: instructorRoleId, permissionId: taskAssignPermId },
    ]);

    // 创建助教角色（无 class:create，无 task:assign）
    const [assistant] = await db
      .insert(teacherRoles)
      .values({ schoolId: testSchoolId, name: "助教老师", code: "assistant" })
      .returning();
    assistantRoleId = assistant.id;
    // 助教不分配这两个权限
  });

  afterAll(async () => {
    await db.delete(teacherRolePermissions).where(eq(teacherRolePermissions.teacherRoleId, instructorRoleId));
    await db.delete(teacherRoles).where(eq(teacherRoles.schoolId, testSchoolId));
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await redis.quit();
  });

  it("should allow school_admin for admin-only routes", () => {
    const auth: AuthContext = {
      userId: "u-001",
      phone: "13800001234",
      roles: ["school_admin"],
      schoolId: testSchoolId,
      activeRole: "school_admin",
    };

    const result = checkIdentityRole(auth, ["school_admin"]);
    expect(result.allowed).toBe(true);
  });

  it("should reject student for admin-only routes", () => {
    const auth: AuthContext = {
      userId: "u-002",
      phone: "13800005678",
      roles: ["student"],
      schoolId: testSchoolId,
      activeRole: "student",
    };

    const result = checkIdentityRole(auth, ["school_admin"]);
    expect(result.allowed).toBe(false);
  });

  it("should deny teacher without required permission", async () => {
    // 助教角色没有 task:assign 权限
    const result = await checkTeacherPermission(assistantRoleId, "task:assign");
    expect(result).toBe(false);
  });

  it("should allow teacher with required permission", async () => {
    // 主讲角色有 task:assign 权限
    const result = await checkTeacherPermission(instructorRoleId, "task:assign");
    expect(result).toBe(true);
  });
});

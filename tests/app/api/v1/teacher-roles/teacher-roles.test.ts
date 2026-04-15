import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { schools } from "@/db/schema/schools";
import { teacherRoles } from "@/db/schema/teacher-roles";
import { teacherRolePermissions } from "@/db/schema/teacher-role-permissions";
import { eq } from "drizzle-orm";
import { TokenService } from "@/domains/auth/token-service";
import { POST } from "@/app/api/v1/teacher-roles/route";
import { NextRequest } from "next/server";

describe("POST /api/v1/teacher-roles", () => {
  const tokenService = new TokenService();
  const testSchoolId = "00000000-0000-0000-0000-c00000000026";
  let adminToken: string;

  beforeAll(async () => {
    await db.insert(schools).values({ id: testSchoolId, name: "Role API 测试校", code: "ROL-API-001" }).onConflictDoNothing();
    const [admin] = await db.insert(users).values({
      phone: "13900260001", name: "角色管理员", schoolId: testSchoolId, roles: ["school_admin"], status: "active",
    }).returning();
    adminToken = await tokenService.createSession({
      userId: admin.id, phone: "13900260001", roles: ["school_admin"], schoolId: testSchoolId, activeRole: "school_admin",
    });
  });

  afterAll(async () => {
    await redis.del(`session:${adminToken}`);
    const roles = await db.select({ id: teacherRoles.id }).from(teacherRoles).where(eq(teacherRoles.schoolId, testSchoolId));
    for (const r of roles) {
      await db.delete(teacherRolePermissions).where(eq(teacherRolePermissions.teacherRoleId, r.id));
    }
    await db.delete(teacherRoles).where(eq(teacherRoles.schoolId, testSchoolId));
    await db.delete(users).where(eq(users.schoolId, testSchoolId));
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await redis.quit();
  });

  it("should create teacher role", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/teacher-roles", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "API主讲老师", code: "api-instructor" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.name).toBe("API主讲老师");
    expect(body.data.code).toBe("api-instructor");
  });
});

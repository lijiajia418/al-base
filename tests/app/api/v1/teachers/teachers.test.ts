import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { schools } from "@/db/schema/schools";
import { teacherProfiles } from "@/db/schema/teacher-profiles";
import { eq } from "drizzle-orm";
import { TokenService } from "@/domains/auth/token-service";
import { POST } from "@/app/api/v1/teachers/route";
import { NextRequest } from "next/server";

describe("POST /api/v1/teachers", () => {
  const tokenService = new TokenService();
  const testSchoolId = "00000000-0000-0000-0000-c00000000022";
  const newTeacherPhone = "13900220002";
  let validToken: string;

  beforeAll(async () => {
    await db.insert(schools).values({ id: testSchoolId, name: "Teacher API 测试校", code: "TCH-API-001" }).onConflictDoNothing();
    const [admin] = await db.insert(users).values({
      phone: "13900220001", name: "管理员", schoolId: testSchoolId, roles: ["school_admin"], status: "active",
    }).returning();
    validToken = await tokenService.createSession({
      userId: admin.id, phone: "13900220001", roles: ["school_admin"], schoolId: testSchoolId, activeRole: "school_admin",
    });
  });

  afterAll(async () => {
    await redis.del(`session:${validToken}`);
    const testUsers = await db.select({ id: users.id }).from(users).where(eq(users.phone, newTeacherPhone));
    for (const u of testUsers) {
      await db.delete(teacherProfiles).where(eq(teacherProfiles.userId, u.id));
    }
    await db.delete(users).where(eq(users.schoolId, testSchoolId));
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await redis.quit();
  });

  it("should create teacher and return 200", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/teachers", {
      method: "POST",
      headers: { Authorization: `Bearer ${validToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: newTeacherPhone, name: "新老师", title: "EAL老师" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.user.roles).toContain("teacher");
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { schools } from "@/db/schema/schools";
import { parentProfiles } from "@/db/schema/parent-profiles";
import { parentStudentRelations } from "@/db/schema/parent-student-relations";
import { eq } from "drizzle-orm";
import { TokenService } from "@/domains/auth/token-service";
import { POST } from "@/app/api/v1/students/[id]/parents/route";
import { NextRequest } from "next/server";

describe("POST /api/v1/students/:studentId/parents", () => {
  const tokenService = new TokenService();
  const testSchoolId = "00000000-0000-0000-0000-c00000000025";
  const parentPhone = "13900250002";
  let teacherToken: string;
  let studentId: string;

  beforeAll(async () => {
    await db.insert(schools).values({ id: testSchoolId, name: "Parent API 测试校", code: "PAR-API-001" }).onConflictDoNothing();
    const [teacher] = await db.insert(users).values({
      phone: "13900250001", name: "家长API测试老师", schoolId: testSchoolId, roles: ["teacher"], status: "active",
    }).returning();
    const [student] = await db.insert(users).values({
      phone: "13900250099", name: "测试学生", schoolId: testSchoolId, roles: ["student"], status: "active",
    }).returning();
    studentId = student.id;

    teacherToken = await tokenService.createSession({
      userId: teacher.id, phone: "13900250001", roles: ["teacher"], schoolId: testSchoolId, activeRole: "teacher",
    });
  });

  afterAll(async () => {
    await redis.del(`session:${teacherToken}`);
    await db.delete(parentStudentRelations).where(eq(parentStudentRelations.studentId, studentId));
    const pUsers = await db.select({ id: users.id }).from(users).where(eq(users.phone, parentPhone));
    for (const u of pUsers) {
      await db.delete(parentProfiles).where(eq(parentProfiles.userId, u.id));
    }
    await db.delete(users).where(eq(users.schoolId, testSchoolId));
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await redis.quit();
  });

  it("should bind parent to student", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/students/${studentId}/parents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${teacherToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: parentPhone, name: "王爸爸", relationType: "father" }),
    });

    const res = await POST(req, { params: Promise.resolve({ studentId }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.user.roles).toContain("parent");
  });
});

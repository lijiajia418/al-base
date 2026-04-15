import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { schools } from "@/db/schema/schools";
import { classes } from "@/db/schema/classes";
import { classTeachers } from "@/db/schema/class-teachers";
import { eq } from "drizzle-orm";
import { TokenService } from "@/domains/auth/token-service";
import { POST } from "@/app/api/v1/classes/route";
import { NextRequest } from "next/server";

describe("POST /api/v1/classes", () => {
  const tokenService = new TokenService();
  const testSchoolId = "00000000-0000-0000-0000-c00000000023";
  let teacherToken: string;
  let teacherId: string;

  beforeAll(async () => {
    await db.insert(schools).values({ id: testSchoolId, name: "Class API 测试校", code: "CLS-API-001" }).onConflictDoNothing();
    const [teacher] = await db.insert(users).values({
      phone: "13900230001", name: "建班老师", schoolId: testSchoolId, roles: ["teacher"], status: "active",
    }).returning();
    teacherId = teacher.id;
    teacherToken = await tokenService.createSession({
      userId: teacherId, phone: "13900230001", roles: ["teacher"], schoolId: testSchoolId, activeRole: "teacher",
    });
  });

  afterAll(async () => {
    await redis.del(`session:${teacherToken}`);
    await db.delete(classTeachers).where(eq(classTeachers.teacherId, teacherId));
    await db.delete(classes).where(eq(classes.schoolId, testSchoolId));
    await db.delete(users).where(eq(users.schoolId, testSchoolId));
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await redis.quit();
  });

  it("should create class and auto-assign teacher", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/classes", {
      method: "POST",
      headers: { Authorization: `Bearer ${teacherToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Year 12 A班", grade: "Year 12" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.name).toBe("Year 12 A班");

    // 验证老师自动加入
    const [ct] = await db.select().from(classTeachers).where(eq(classTeachers.classId, body.data.id));
    expect(ct).toBeTruthy();
    expect(ct.teacherId).toBe(teacherId);
  });
});

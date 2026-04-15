import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { schools } from "@/db/schema/schools";
import { classes } from "@/db/schema/classes";
import { classTeachers } from "@/db/schema/class-teachers";
import { classStudents } from "@/db/schema/class-students";
import { studentProfiles } from "@/db/schema/student-profiles";
import { eq } from "drizzle-orm";
import { TokenService } from "@/domains/auth/token-service";
import { POST } from "@/app/api/v1/classes/[id]/students/route";
import { NextRequest } from "next/server";

describe("POST /api/v1/classes/:classId/students", () => {
  const tokenService = new TokenService();
  const testSchoolId = "00000000-0000-0000-0000-c00000000024";
  const studentPhone = "13900240002";
  let teacherToken: string;
  let teacherId: string;
  let testClassId: string;

  beforeAll(async () => {
    await db.insert(schools).values({ id: testSchoolId, name: "Student API 测试校", code: "STU-API-001" }).onConflictDoNothing();
    const [teacher] = await db.insert(users).values({
      phone: "13900240001", name: "学生API测试老师", schoolId: testSchoolId, roles: ["teacher"], status: "active",
    }).returning();
    teacherId = teacher.id;
    const [cls] = await db.insert(classes).values({ schoolId: testSchoolId, name: "API测试班", createdBy: teacherId }).returning();
    testClassId = cls.id;
    await db.insert(classTeachers).values({ classId: testClassId, teacherId });

    teacherToken = await tokenService.createSession({
      userId: teacherId, phone: "13900240001", roles: ["teacher"], schoolId: testSchoolId, activeRole: "teacher",
    });
  });

  afterAll(async () => {
    await redis.del(`session:${teacherToken}`);
    const stu = await db.select({ id: users.id }).from(users).where(eq(users.phone, studentPhone));
    for (const u of stu) {
      await db.delete(studentProfiles).where(eq(studentProfiles.userId, u.id));
    }
    await db.delete(classStudents).where(eq(classStudents.classId, testClassId));
    await db.delete(classTeachers).where(eq(classTeachers.classId, testClassId));
    await db.delete(classes).where(eq(classes.id, testClassId));
    await db.delete(users).where(eq(users.schoolId, testSchoolId));
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await redis.quit();
  });

  it("should add student to class", async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/classes/${testClassId}/students`, {
      method: "POST",
      headers: { Authorization: `Bearer ${teacherToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: studentPhone, name: "API学生" }),
    });

    const res = await POST(req, { params: Promise.resolve({ classId: testClassId }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.user.roles).toContain("student");
  });
});

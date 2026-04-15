import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { schools } from "@/db/schema/schools";
import { classes } from "@/db/schema/classes";
import { classTeachers } from "@/db/schema/class-teachers";
import { classStudents } from "@/db/schema/class-students";
import { teacherProfiles } from "@/db/schema/teacher-profiles";
import { studentProfiles } from "@/db/schema/student-profiles";
import { parentProfiles } from "@/db/schema/parent-profiles";
import { parentStudentRelations } from "@/db/schema/parent-student-relations";
import { eq } from "drizzle-orm";
import { TokenService } from "@/domains/auth/token-service";

import { POST as createTeacher } from "@/app/api/v1/teachers/route";
import { POST as createClass } from "@/app/api/v1/classes/route";
import { POST as addStudent } from "@/app/api/v1/classes/[id]/students/route";
import { POST as addParent } from "@/app/api/v1/students/[id]/parents/route";
import { GET as getChildren } from "@/app/api/v1/parents/children/route";
import { NextRequest } from "next/server";

/**
 * E2E 组织管理流程：
 * 管理员添加老师 → 老师创建班级 → 老师添加学生 → 老师为学生绑定家长 → 家长查看孩子
 */
describe("E2E: Organization Management Flow", () => {
  const tokenService = new TokenService();
  const testSchoolId = "00000000-0000-0000-0000-e2e000000002";
  let adminToken: string;
  let teacherToken: string;
  let parentToken: string;
  let teacherId: string;
  let classId: string;
  let studentId: string;

  beforeAll(async () => {
    await db.insert(schools).values({
      id: testSchoolId, name: "E2E组织测试校", code: "E2E-ORG-001",
    }).onConflictDoNothing();

    const [admin] = await db.insert(users).values({
      phone: "13800990001", name: "E2E管理员", schoolId: testSchoolId,
      roles: ["school_admin"], status: "active",
    }).returning();

    adminToken = await tokenService.createSession({
      userId: admin.id, phone: "13800990001", roles: ["school_admin"],
      schoolId: testSchoolId, activeRole: "school_admin",
    });
  });

  afterAll(async () => {
    // 清理所有测试数据
    if (adminToken) await redis.del(`session:${adminToken}`);
    if (teacherToken) await redis.del(`session:${teacherToken}`);
    if (parentToken) await redis.del(`session:${parentToken}`);

    if (studentId) {
      await db.delete(parentStudentRelations).where(eq(parentStudentRelations.studentId, studentId));
    }
    if (classId) {
      await db.delete(classStudents).where(eq(classStudents.classId, classId));
      await db.delete(classTeachers).where(eq(classTeachers.classId, classId));
      await db.delete(classes).where(eq(classes.id, classId));
    }

    const testUsers = await db.select({ id: users.id }).from(users).where(eq(users.schoolId, testSchoolId));
    for (const u of testUsers) {
      await db.delete(teacherProfiles).where(eq(teacherProfiles.userId, u.id)).catch(() => {});
      await db.delete(studentProfiles).where(eq(studentProfiles.userId, u.id)).catch(() => {});
      await db.delete(parentProfiles).where(eq(parentProfiles.userId, u.id)).catch(() => {});
    }
    await db.delete(users).where(eq(users.schoolId, testSchoolId));
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await redis.quit();
  });

  it("should complete admin → teacher → class → student → parent → view flow", async () => {
    // 1. 管理员添加老师
    const teacherRes = await createTeacher(new NextRequest("http://localhost/api/v1/teachers", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "13800990002", name: "E2E老师", title: "IELTS老师" }),
    }));
    const teacherBody = await teacherRes.json();
    expect(teacherRes.status).toBe(200);
    teacherId = teacherBody.data.user.id;

    // 2. 老师登录（模拟创建 session）
    teacherToken = await tokenService.createSession({
      userId: teacherId, phone: "13800990002", roles: ["teacher"],
      schoolId: testSchoolId, activeRole: "teacher",
    });

    // 3. 老师创建班级
    const classRes = await createClass(new NextRequest("http://localhost/api/v1/classes", {
      method: "POST",
      headers: { Authorization: `Bearer ${teacherToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "E2E测试班", grade: "Year 12" }),
    }));
    const classBody = await classRes.json();
    expect(classRes.status).toBe(200);
    classId = classBody.data.id;

    // 4. 老师添加学生到班级
    const studentRes = await addStudent(
      new NextRequest(`http://localhost/api/v1/classes/${classId}/students`, {
        method: "POST",
        headers: { Authorization: `Bearer ${teacherToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "13800990003", name: "E2E学生", grade: "Year 12" }),
      }),
      { params: Promise.resolve({ classId }) }
    );
    const studentBody = await studentRes.json();
    expect(studentRes.status).toBe(200);
    studentId = studentBody.data.user.id;

    // 5. 老师为学生绑定家长
    const parentRes = await addParent(
      new NextRequest(`http://localhost/api/v1/students/${studentId}/parents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${teacherToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "13800990004", name: "E2E家长", relationType: "father" }),
      }),
      { params: Promise.resolve({ studentId }) }
    );
    const parentBody = await parentRes.json();
    expect(parentRes.status).toBe(200);
    const parentId = parentBody.data.user.id;

    // 6. 家长登录查看孩子
    parentToken = await tokenService.createSession({
      userId: parentId, phone: "13800990004", roles: ["parent"],
      schoolId: testSchoolId, activeRole: "parent",
    });

    const childrenRes = await getChildren(new NextRequest("http://localhost/api/v1/parents/children", {
      headers: { Authorization: `Bearer ${parentToken}` },
    }));
    const childrenBody = await childrenRes.json();
    expect(childrenRes.status).toBe(200);
    expect(childrenBody.data.length).toBe(1);
    expect(childrenBody.data[0].name).toBe("E2E学生");
  });
});

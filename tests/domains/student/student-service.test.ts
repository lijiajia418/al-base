import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db";
import { schools } from "@/db/schema/schools";
import { users } from "@/db/schema/users";
import { classes } from "@/db/schema/classes";
import { classStudents } from "@/db/schema/class-students";
import { classTeachers } from "@/db/schema/class-teachers";
import { studentProfiles } from "@/db/schema/student-profiles";
import { eq } from "drizzle-orm";
import { redis } from "@/lib/redis";
import { StudentService } from "@/domains/student/student-service";

describe("StudentService", () => {
  const studentService = new StudentService();
  const testSchoolId = "00000000-0000-0000-0000-b00000000004";
  const studentPhone = "13900040001";
  let testClassId: string;
  let testTeacherId: string;

  beforeAll(async () => {
    await db.insert(schools).values({ id: testSchoolId, name: "学生服务测试校", code: "STU-SVC-001" }).onConflictDoNothing();

    const [teacher] = await db.insert(users).values({
      phone: "13900040099", name: "学生测试老师", schoolId: testSchoolId, roles: ["teacher"], status: "active",
    }).returning();
    testTeacherId = teacher.id;

    const [cls] = await db.insert(classes).values({
      schoolId: testSchoolId, name: "学生测试班", grade: "Year 12", createdBy: testTeacherId,
    }).returning();
    testClassId = cls.id;
  });

  afterAll(async () => {
    await db.delete(classStudents).where(eq(classStudents.classId, testClassId));
    // Delete student profiles for test users
    const testUsers = await db.select({ id: users.id }).from(users).where(eq(users.phone, studentPhone));
    for (const u of testUsers) {
      await db.delete(studentProfiles).where(eq(studentProfiles.userId, u.id));
    }
    await db.delete(users).where(eq(users.phone, studentPhone));
    await db.delete(classes).where(eq(classes.id, testClassId));
    await db.delete(users).where(eq(users.schoolId, testSchoolId));
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await redis.quit();
  });

  it("should add student to class, creating user + profile + class_students", async () => {
    const result = await studentService.addStudent(testClassId, testSchoolId, {
      phone: studentPhone,
      name: "王小明",
      grade: "Year 12",
      targetScore: "6.5",
      examDate: "2026-11-01",
      groupName: "A组",
    });

    expect(result.success).toBe(true);
    expect(result.user).toBeTruthy();
    expect(result.user!.roles).toContain("student");

    // 验证 student_profile
    const [profile] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, result.user!.id));
    expect(profile).toBeTruthy();
    expect(profile.grade).toBe("Year 12");

    // 验证 class_students
    const [cs] = await db.select().from(classStudents)
      .where(eq(classStudents.studentId, result.user!.id));
    expect(cs).toBeTruthy();
    expect(cs.groupName).toBe("A组");
  });
});

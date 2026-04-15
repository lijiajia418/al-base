import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db";
import { schools } from "@/db/schema/schools";
import { users } from "@/db/schema/users";
import { classes } from "@/db/schema/classes";
import { classTeachers } from "@/db/schema/class-teachers";
import { eq } from "drizzle-orm";
import { redis } from "@/lib/redis";
import { ClassService } from "@/domains/class/class-service";

describe("ClassService", () => {
  const classService = new ClassService();
  const testSchoolId = "00000000-0000-0000-0000-b00000000003";
  let testTeacherId: string;

  beforeAll(async () => {
    await db.insert(schools).values({
      id: testSchoolId,
      name: "班级服务测试校",
      code: "CLS-SVC-001",
    }).onConflictDoNothing();

    const [teacher] = await db.insert(users).values({
      phone: "13900030001",
      name: "班级测试老师",
      schoolId: testSchoolId,
      roles: ["teacher"],
      status: "active",
    }).returning();
    testTeacherId = teacher.id;
  });

  afterAll(async () => {
    await db.delete(classTeachers).where(eq(classTeachers.teacherId, testTeacherId));
    await db.delete(classes).where(eq(classes.schoolId, testSchoolId));
    await db.delete(users).where(eq(users.schoolId, testSchoolId));
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await redis.quit();
  });

  it("should create class and auto-assign creator as teacher", async () => {
    const result = await classService.createClass(testSchoolId, testTeacherId, {
      name: "Year 12 IELTS A班",
      grade: "Year 12",
      academicYear: "2025-2026",
      stage: "foundation",
    });

    expect(result).toBeTruthy();
    expect(result!.name).toBe("Year 12 IELTS A班");

    // 验证 class_teachers 自动创建
    const [ct] = await db
      .select()
      .from(classTeachers)
      .where(eq(classTeachers.classId, result!.id));
    expect(ct).toBeTruthy();
    expect(ct.teacherId).toBe(testTeacherId);
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db";
import { schools } from "@/db/schema/schools";
import { users } from "@/db/schema/users";
import { teacherProfiles } from "@/db/schema/teacher-profiles";
import { eq } from "drizzle-orm";
import { redis } from "@/lib/redis";
import { TeacherService } from "@/domains/teacher/teacher-service";

describe("TeacherService", () => {
  const teacherService = new TeacherService();
  const testSchoolId = "00000000-0000-0000-0000-b00000000002";
  const testPhone = "13900020001";

  beforeAll(async () => {
    await db.insert(schools).values({
      id: testSchoolId,
      name: "老师服务测试校",
      code: "TCH-SVC-001",
    }).onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(teacherProfiles).where(
      eq(teacherProfiles.userId,
        db.select({ id: users.id }).from(users).where(eq(users.phone, testPhone))
      )
    ).catch(() => {});
    await db.delete(users).where(eq(users.phone, testPhone));
    await db.delete(users).where(eq(users.schoolId, testSchoolId));
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await redis.quit();
  });

  it("should add teacher by phone, creating user and teacher_profile", async () => {
    const result = await teacherService.addTeacher(testSchoolId, {
      phone: testPhone,
      name: "张老师",
      title: "IELTS老师",
      subjects: ["IELTS"],
    });

    expect(result.success).toBe(true);
    expect(result.user).toBeTruthy();
    expect(result.user!.roles).toContain("teacher");

    // 验证 teacher_profile 已创建
    const [profile] = await db
      .select()
      .from(teacherProfiles)
      .where(eq(teacherProfiles.userId, result.user!.id));
    expect(profile).toBeTruthy();
    expect(profile.title).toBe("IELTS老师");
    expect(profile.subjects).toEqual(["IELTS"]);
  });
});

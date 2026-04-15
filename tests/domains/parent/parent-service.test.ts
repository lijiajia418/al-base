import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db";
import { schools } from "@/db/schema/schools";
import { users } from "@/db/schema/users";
import { parentProfiles } from "@/db/schema/parent-profiles";
import { parentStudentRelations } from "@/db/schema/parent-student-relations";
import { eq } from "drizzle-orm";
import { redis } from "@/lib/redis";
import { ParentService } from "@/domains/parent/parent-service";

describe("ParentService", () => {
  const parentService = new ParentService();
  const testSchoolId = "00000000-0000-0000-0000-b00000000005";
  const parentPhone = "13900050001";
  let testStudentId: string;

  beforeAll(async () => {
    await db.insert(schools).values({ id: testSchoolId, name: "家长服务测试校", code: "PAR-SVC-001" }).onConflictDoNothing();

    const [student] = await db.insert(users).values({
      phone: "13900050099", name: "测试学生", schoolId: testSchoolId, roles: ["student"], status: "active",
    }).returning();
    testStudentId = student.id;
  });

  afterAll(async () => {
    await db.delete(parentStudentRelations).where(eq(parentStudentRelations.studentId, testStudentId));
    const parentUsers = await db.select({ id: users.id }).from(users).where(eq(users.phone, parentPhone));
    for (const u of parentUsers) {
      await db.delete(parentProfiles).where(eq(parentProfiles.userId, u.id));
    }
    await db.delete(users).where(eq(users.phone, parentPhone));
    await db.delete(users).where(eq(users.schoolId, testSchoolId));
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await redis.quit();
  });

  it("should add parent binding, creating user + profile + relation", async () => {
    const result = await parentService.addParent(testStudentId, testSchoolId, {
      phone: parentPhone,
      name: "王爸爸",
      relationType: "father",
    });

    expect(result.success).toBe(true);
    expect(result.user).toBeTruthy();
    expect(result.user!.roles).toContain("parent");

    // 验证 parent_profile
    const [profile] = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, result.user!.id));
    expect(profile).toBeTruthy();

    // 验证 parent_student_relations
    const [rel] = await db.select().from(parentStudentRelations)
      .where(eq(parentStudentRelations.parentId, result.user!.id));
    expect(rel).toBeTruthy();
    expect(rel.relationType).toBe("father");
    expect(rel.bindingStatus).toBe("active");
  });
});

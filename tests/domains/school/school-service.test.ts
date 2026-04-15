import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db";
import { schools } from "@/db/schema/schools";
import { users } from "@/db/schema/users";
import { eq } from "drizzle-orm";
import { redis } from "@/lib/redis";
import { SchoolService } from "@/domains/school/school-service";

describe("SchoolService", () => {
  const schoolService = new SchoolService();
  const testSchoolId = "00000000-0000-0000-0000-b00000000001";

  beforeAll(async () => {
    await db.insert(schools).values({
      id: testSchoolId,
      name: "学校服务测试校",
      code: "SCH-SVC-001",
      settings: { gradingScale: "ielts_9" },
    }).onConflictDoNothing();

    // 插入几个用户用于统计
    await db.insert(users).values([
      { phone: "13900010001", name: "老师A", schoolId: testSchoolId, roles: ["teacher"], status: "active" },
      { phone: "13900010002", name: "学生A", schoolId: testSchoolId, roles: ["student"], status: "active" },
      { phone: "13900010003", name: "学生B", schoolId: testSchoolId, roles: ["student"], status: "active" },
    ]).onConflictDoNothing();
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.schoolId, testSchoolId));
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await redis.quit();
  });

  it("should get school by id with correct data", async () => {
    const school = await schoolService.getSchool(testSchoolId);

    expect(school).not.toBeNull();
    expect(school!.name).toBe("学校服务测试校");
    expect(school!.code).toBe("SCH-SVC-001");
    expect(school!.settings).toEqual({ gradingScale: "ielts_9" });
  });

  it("should return stats with correct counts", async () => {
    const stats = await schoolService.getStats(testSchoolId);

    expect(stats.teacherCount).toBeGreaterThanOrEqual(1);
    expect(stats.studentCount).toBeGreaterThanOrEqual(2);
  });
});

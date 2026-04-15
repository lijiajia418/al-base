import { db } from "@/db";
import { schools } from "@/db/schema/schools";
import { users } from "@/db/schema/users";
import { classes } from "@/db/schema/classes";
import { parentStudentRelations } from "@/db/schema/parent-student-relations";
import { eq, and, sql } from "drizzle-orm";

export class SchoolService {
  async getSchool(schoolId: string) {
    const [school] = await db
      .select()
      .from(schools)
      .where(eq(schools.id, schoolId));
    return school ?? null;
  }

  async updateSchool(schoolId: string, data: { name?: string; settings?: Record<string, unknown> }) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name) updates.name = data.name;
    if (data.settings) updates.settings = data.settings;

    const [updated] = await db
      .update(schools)
      .set(updates)
      .where(eq(schools.id, schoolId))
      .returning();
    return updated ?? null;
  }

  async getStats(schoolId: string) {
    // 老师数
    const [teacherResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.schoolId, schoolId), sql`'teacher' = ANY(${users.roles})`));

    // 学生数
    const [studentResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.schoolId, schoolId), sql`'student' = ANY(${users.roles})`));

    // 家长数
    const [parentResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.schoolId, schoolId), sql`'parent' = ANY(${users.roles})`));

    // 班级总数
    const [classTotal] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(classes)
      .where(eq(classes.schoolId, schoolId));

    // 活跃班级数
    const [classActive] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(classes)
      .where(and(eq(classes.schoolId, schoolId), eq(classes.status, "active")));

    return {
      teacherCount: teacherResult?.count ?? 0,
      studentCount: studentResult?.count ?? 0,
      parentCount: parentResult?.count ?? 0,
      classCount: classTotal?.count ?? 0,
      activeClassCount: classActive?.count ?? 0,
    };
  }
}

import { db } from "@/db";
import { classes } from "@/db/schema/classes";
import { classTeachers } from "@/db/schema/class-teachers";
import { classStudents } from "@/db/schema/class-students";
import { users } from "@/db/schema/users";
import { eq, and, sql } from "drizzle-orm";

interface CreateClassParams {
  name: string;
  grade?: string;
  academicYear?: string;
  stage?: string;
  primaryTeacherId?: string;
}

export class ClassService {
  async createClass(schoolId: string, creatorId: string, params: CreateClassParams) {
    const { name, grade, academicYear, stage, primaryTeacherId } = params;

    const [cls] = await db
      .insert(classes)
      .values({
        schoolId,
        name,
        grade: grade ?? null,
        academicYear: academicYear ?? null,
        stage: stage ?? null,
        createdBy: creatorId,
      })
      .returning();

    // 自动将创建者加入 class_teachers
    await db.insert(classTeachers).values({
      classId: cls.id,
      teacherId: creatorId,
    });

    // 如果指定了其他主讲老师且不是创建者
    if (primaryTeacherId && primaryTeacherId !== creatorId) {
      await db.insert(classTeachers).values({
        classId: cls.id,
        teacherId: primaryTeacherId,
      });
    }

    return cls;
  }

  async listClasses(schoolId: string, filters?: { grade?: string; status?: string; teacherId?: string; page?: number; pageSize?: number }) {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(classes.schoolId, schoolId)];
    if (filters?.status) conditions.push(eq(classes.status, filters.status));

    // 老师只看自己的班级
    if (filters?.teacherId) {
      const teacherClassIds = db
        .select({ classId: classTeachers.classId })
        .from(classTeachers)
        .where(eq(classTeachers.teacherId, filters.teacherId));

      conditions.push(sql`${classes.id} IN (${teacherClassIds})`);
    }

    const items = await db
      .select()
      .from(classes)
      .where(and(...conditions))
      .limit(pageSize)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(classes)
      .where(and(...conditions));

    return {
      items,
      total: countResult?.count ?? 0,
      page,
      pageSize,
    };
  }

  async getClass(classId: string, schoolId?: string) {
    const conditions = [eq(classes.id, classId)];
    if (schoolId) conditions.push(eq(classes.schoolId, schoolId));

    const [cls] = await db.select().from(classes).where(and(...conditions));
    if (!cls) return null;

    // 获取老师列表
    const teachers = await db
      .select({
        id: users.id,
        name: users.name,
        teacherRoleId: classTeachers.teacherRoleId,
        joinedAt: classTeachers.joinedAt,
      })
      .from(classTeachers)
      .innerJoin(users, eq(classTeachers.teacherId, users.id))
      .where(eq(classTeachers.classId, classId));

    // 学生数量
    const [studentCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(classStudents)
      .where(and(eq(classStudents.classId, classId), eq(classStudents.status, "active")));

    // 分组统计
    const groups = await db
      .select({ groupName: classStudents.groupName, count: sql<number>`count(*)::int` })
      .from(classStudents)
      .where(and(eq(classStudents.classId, classId), eq(classStudents.status, "active")))
      .groupBy(classStudents.groupName);

    const groupSummary: Record<string, number> = {};
    groups.forEach((g) => {
      groupSummary[g.groupName ?? "未分组"] = g.count;
    });

    return {
      ...cls,
      teachers,
      studentCount: studentCount?.count ?? 0,
      groupSummary,
    };
  }

  async updateClass(classId: string, data: { name?: string; grade?: string; stage?: string }) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name) updates.name = data.name;
    if (data.grade !== undefined) updates.grade = data.grade;
    if (data.stage !== undefined) updates.stage = data.stage;

    const [updated] = await db.update(classes).set(updates).where(eq(classes.id, classId)).returning();
    return updated ?? null;
  }

  async updateClassStatus(classId: string, action: "archive" | "activate") {
    const status = action === "archive" ? "archived" : "active";
    await db.update(classes).set({ status, updatedAt: new Date() }).where(eq(classes.id, classId));
  }

  async assignTeacher(classId: string, teacherId: string, teacherRoleId?: string) {
    // 检查是否已在班级
    const [existing] = await db
      .select()
      .from(classTeachers)
      .where(and(eq(classTeachers.classId, classId), eq(classTeachers.teacherId, teacherId)));

    if (existing) return { success: false, error: "ALREADY_IN_CLASS" };

    await db.insert(classTeachers).values({
      classId,
      teacherId,
      teacherRoleId: teacherRoleId ?? null,
    });
    return { success: true };
  }

  async removeTeacher(classId: string, teacherId: string) {
    const result = await db
      .delete(classTeachers)
      .where(and(eq(classTeachers.classId, classId), eq(classTeachers.teacherId, teacherId)));
    return { success: true };
  }
}

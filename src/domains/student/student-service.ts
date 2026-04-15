import { db } from "@/db";
import { users } from "@/db/schema/users";
import { studentProfiles } from "@/db/schema/student-profiles";
import { classStudents } from "@/db/schema/class-students";
import { classes } from "@/db/schema/classes";
import { parentStudentRelations } from "@/db/schema/parent-student-relations";
import { eq, and, sql } from "drizzle-orm";

interface AddStudentParams {
  phone: string;
  name: string;
  grade?: string;
  targetScore?: string;
  examDate?: string;
  groupName?: string;
}

export class StudentService {
  async addStudent(classId: string, schoolId: string, params: AddStudentParams) {
    const { phone, name, grade, targetScore, examDate, groupName } = params;

    // 查找已有用户
    let [user] = await db.select().from(users).where(eq(users.phone, phone));

    if (user) {
      // 检查是否已在该班级
      const [existing] = await db.select().from(classStudents)
        .where(and(eq(classStudents.classId, classId), eq(classStudents.studentId, user.id)));
      if (existing) return { success: false, error: "ALREADY_IN_CLASS" };

      // 追加 student 角色
      if (!(user.roles ?? []).includes("student")) {
        const newRoles = [...(user.roles ?? []), "student"];
        [user] = await db.update(users).set({ roles: newRoles, updatedAt: new Date() }).where(eq(users.id, user.id)).returning();
      }
    } else {
      // 新建用户
      [user] = await db.insert(users).values({
        phone,
        name,
        schoolId,
        roles: ["student"],
        status: "pending_activation",
      }).returning();
    }

    // 创建/更新 student_profile
    const [existingProfile] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, user.id));
    if (!existingProfile) {
      await db.insert(studentProfiles).values({
        userId: user.id,
        grade: grade ?? null,
        targetScore: targetScore ?? null,
        examDate: examDate ?? null,
      });
    }

    // 加入班级
    await db.insert(classStudents).values({
      classId,
      studentId: user.id,
      groupName: groupName ?? null,
      status: "active",
    });

    return { success: true, user };
  }

  async listStudents(classId: string, filters?: { groupName?: string; status?: string; page?: number; pageSize?: number }) {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 50;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(classStudents.classId, classId)];
    if (filters?.status) conditions.push(eq(classStudents.status, filters.status));
    if (filters?.groupName) conditions.push(eq(classStudents.groupName, filters.groupName));

    const items = await db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        grade: studentProfiles.grade,
        targetScore: studentProfiles.targetScore,
        examDate: studentProfiles.examDate,
        groupName: classStudents.groupName,
        status: classStudents.status,
        joinedAt: classStudents.joinedAt,
      })
      .from(classStudents)
      .innerJoin(users, eq(classStudents.studentId, users.id))
      .leftJoin(studentProfiles, eq(users.id, studentProfiles.userId))
      .where(and(...conditions))
      .limit(pageSize)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(classStudents)
      .where(and(...conditions));

    // 补充 parentCount
    const itemsWithParentCount = await Promise.all(items.map(async (item) => {
      const [pc] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(parentStudentRelations)
        .where(and(eq(parentStudentRelations.studentId, item.id), eq(parentStudentRelations.bindingStatus, "active")));
      return { ...item, parentCount: pc?.count ?? 0 };
    }));

    return { items: itemsWithParentCount, total: countResult?.count ?? 0, page, pageSize };
  }

  async getStudent(studentId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, studentId));
    if (!user) return null;

    const [profile] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, studentId));

    // 所在班级
    const studentClasses = await db
      .select({ id: classes.id, name: classes.name, groupName: classStudents.groupName, status: classStudents.status })
      .from(classStudents)
      .innerJoin(classes, eq(classStudents.classId, classes.id))
      .where(eq(classStudents.studentId, studentId));

    // 绑定的家长
    const parents = await db
      .select({ id: users.id, name: users.name, phone: users.phone, relationType: parentStudentRelations.relationType, bindingStatus: parentStudentRelations.bindingStatus })
      .from(parentStudentRelations)
      .innerJoin(users, eq(parentStudentRelations.parentId, users.id))
      .where(eq(parentStudentRelations.studentId, studentId));

    return {
      id: user.id, name: user.name, phone: user.phone, status: user.status,
      grade: profile?.grade, targetScore: profile?.targetScore, examDate: profile?.examDate,
      classes: studentClasses, parents,
    };
  }

  async updateClassStudent(classId: string, studentId: string, data: { groupName?: string; status?: string }) {
    const updates: Record<string, unknown> = {};
    if (data.groupName !== undefined) updates.groupName = data.groupName;
    if (data.status !== undefined) updates.status = data.status;

    await db.update(classStudents).set(updates)
      .where(and(eq(classStudents.classId, classId), eq(classStudents.studentId, studentId)));
  }
}

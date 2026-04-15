import { db } from "@/db";
import { users } from "@/db/schema/users";
import { teacherProfiles } from "@/db/schema/teacher-profiles";
import { classTeachers } from "@/db/schema/class-teachers";
import { classes } from "@/db/schema/classes";
import { eq, and, sql, ilike, or } from "drizzle-orm";

interface AddTeacherParams {
  phone: string;
  name: string;
  title?: string;
  subjects?: string[];
}

export class TeacherService {
  async addTeacher(schoolId: string, params: AddTeacherParams) {
    const { phone, name, title, subjects } = params;

    // 查找已有用户
    let [user] = await db.select().from(users).where(eq(users.phone, phone));

    if (user) {
      // 已有用户：检查是否已是老师
      if ((user.roles ?? []).includes("teacher")) {
        return { success: false, error: "ALREADY_TEACHER" };
      }
      // 追加 teacher 角色
      const newRoles = [...(user.roles ?? []), "teacher"];
      [user] = await db
        .update(users)
        .set({ roles: newRoles, schoolId, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
    } else {
      // 新用户
      [user] = await db
        .insert(users)
        .values({
          phone,
          name,
          schoolId,
          roles: ["teacher"],
          status: "pending_activation",
        })
        .returning();
    }

    // 创建 teacher_profile（如不存在）
    const [existingProfile] = await db
      .select()
      .from(teacherProfiles)
      .where(eq(teacherProfiles.userId, user.id));

    if (!existingProfile) {
      await db.insert(teacherProfiles).values({
        userId: user.id,
        title: title ?? null,
        subjects: subjects ?? [],
      });
    }

    return { success: true, user };
  }

  async listTeachers(schoolId: string, filters?: { status?: string; keyword?: string; page?: number; pageSize?: number }) {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [eq(users.schoolId, schoolId), sql`'teacher' = ANY(${users.roles})`];
    if (filters?.keyword) {
      conditions.push(ilike(users.name, `%${filters.keyword}%`));
    }
    if (filters?.status) {
      conditions.push(eq(users.status, filters.status));
    }

    const items = await db
      .select()
      .from(users)
      .innerJoin(teacherProfiles, eq(users.id, teacherProfiles.userId))
      .where(and(...conditions))
      .limit(pageSize)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .innerJoin(teacherProfiles, eq(users.id, teacherProfiles.userId))
      .where(and(...conditions));

    // 补充 classCount
    const itemsWithCount = await Promise.all(items.map(async (row) => {
      const [cc] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(classTeachers)
        .where(eq(classTeachers.teacherId, row.users.id));
      return {
        id: row.users.id,
        name: row.users.name,
        phone: row.users.phone,
        status: row.users.status,
        title: row.teacher_profiles.title,
        subjects: row.teacher_profiles.subjects,
        employmentStatus: row.teacher_profiles.employmentStatus,
        classCount: cc?.count ?? 0,
        createdAt: row.users.createdAt,
      };
    }));

    return {
      items: itemsWithCount,
      total: countResult?.count ?? 0,
      page,
      pageSize,
    };
  }

  async getTeacher(userId: string, schoolId?: string) {
    const conditions = [eq(users.id, userId)];
    if (schoolId) conditions.push(eq(users.schoolId, schoolId));

    const [row] = await db
      .select()
      .from(users)
      .innerJoin(teacherProfiles, eq(users.id, teacherProfiles.userId))
      .where(and(...conditions));

    if (!row) return null;

    // 查负责的班级
    const teacherClasses = await db
      .select({
        classId: classes.id,
        className: classes.name,
        teacherRoleId: classTeachers.teacherRoleId,
      })
      .from(classTeachers)
      .innerJoin(classes, eq(classTeachers.classId, classes.id))
      .where(eq(classTeachers.teacherId, userId));

    return {
      id: row.users.id,
      name: row.users.name,
      phone: row.users.phone,
      status: row.users.status,
      lastLoginAt: row.users.lastLoginAt,
      createdAt: row.users.createdAt,
      title: row.teacher_profiles.title,
      subjects: row.teacher_profiles.subjects,
      employmentStatus: row.teacher_profiles.employmentStatus,
      teacherRoleId: row.teacher_profiles.teacherRoleId,
      classes: teacherClasses,
    };
  }

  async updateTeacher(userId: string, data: { name?: string; title?: string; subjects?: string[] }) {
    if (data.name) {
      await db.update(users).set({ name: data.name, updatedAt: new Date() }).where(eq(users.id, userId));
    }
    const profileUpdates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) profileUpdates.title = data.title;
    if (data.subjects !== undefined) profileUpdates.subjects = data.subjects;

    if (Object.keys(profileUpdates).length > 1) {
      await db.update(teacherProfiles).set(profileUpdates).where(eq(teacherProfiles.userId, userId));
    }
  }

  async updateTeacherStatus(userId: string, action: "suspend" | "activate" | "resign") {
    if (action === "suspend") {
      await db.update(users).set({ status: "suspended", updatedAt: new Date() }).where(eq(users.id, userId));
    } else if (action === "activate") {
      await db.update(users).set({ status: "active", updatedAt: new Date() }).where(eq(users.id, userId));
    } else if (action === "resign") {
      await db.update(teacherProfiles).set({ employmentStatus: "resigned", updatedAt: new Date() }).where(eq(teacherProfiles.userId, userId));
    }
  }
}

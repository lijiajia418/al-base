import { db } from "@/db";
import { users } from "@/db/schema/users";
import { parentProfiles } from "@/db/schema/parent-profiles";
import { parentStudentRelations } from "@/db/schema/parent-student-relations";
import { classes } from "@/db/schema/classes";
import { classStudents } from "@/db/schema/class-students";
import { eq, and } from "drizzle-orm";

interface AddParentParams {
  phone: string;
  name?: string;
  relationType: string;
}

export class ParentService {
  async addParent(studentId: string, schoolId: string, params: AddParentParams) {
    const { phone, name, relationType } = params;

    // 查找学生
    const [student] = await db.select().from(users).where(eq(users.id, studentId));
    if (!student) return { success: false, error: "STUDENT_NOT_FOUND" };

    // 不能用学生自己的手机号
    if (student.phone === phone) return { success: false, error: "SAME_PHONE" };

    // 查找已有用户
    let [user] = await db.select().from(users).where(eq(users.phone, phone));

    if (user) {
      // 检查是否已绑定
      const [existing] = await db.select().from(parentStudentRelations)
        .where(and(eq(parentStudentRelations.parentId, user.id), eq(parentStudentRelations.studentId, studentId)));
      if (existing) return { success: false, error: "ALREADY_BOUND" };

      // 追加 parent 角色
      if (!(user.roles ?? []).includes("parent")) {
        const newRoles = [...(user.roles ?? []), "parent"];
        [user] = await db.update(users).set({ roles: newRoles, updatedAt: new Date() }).where(eq(users.id, user.id)).returning();
      }
    } else {
      // 新建用户
      [user] = await db.insert(users).values({
        phone,
        name: name || phone,
        schoolId,
        roles: ["parent"],
        status: "pending_activation",
      }).returning();
    }

    // 创建 parent_profile（如不存在）
    const [existingProfile] = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, user.id));
    if (!existingProfile) {
      await db.insert(parentProfiles).values({
        userId: user.id,
        relationType,
      });
    }

    // 创建绑定关系
    await db.insert(parentStudentRelations).values({
      parentId: user.id,
      studentId,
      relationType,
      bindingStatus: "active",
    });

    return { success: true, user };
  }

  async listParents(studentId: string) {
    const parents = await db
      .select({
        relationId: parentStudentRelations.id,
        parentId: users.id,
        name: users.name,
        phone: users.phone,
        relationType: parentStudentRelations.relationType,
        bindingStatus: parentStudentRelations.bindingStatus,
      })
      .from(parentStudentRelations)
      .innerJoin(users, eq(parentStudentRelations.parentId, users.id))
      .where(eq(parentStudentRelations.studentId, studentId));

    return parents;
  }

  async updateBinding(relationId: string, bindingStatus: string) {
    await db.update(parentStudentRelations)
      .set({ bindingStatus, updatedAt: new Date() })
      .where(eq(parentStudentRelations.id, relationId));
  }

  async listChildren(parentId: string) {
    const children = await db
      .select({
        studentId: users.id,
        name: users.name,
        relationType: parentStudentRelations.relationType,
      })
      .from(parentStudentRelations)
      .innerJoin(users, eq(parentStudentRelations.studentId, users.id))
      .where(and(
        eq(parentStudentRelations.parentId, parentId),
        eq(parentStudentRelations.bindingStatus, "active")
      ));

    return children;
  }
}

import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";

export const classTeachers = pgTable("class_teachers", {
  id: uuid("id").primaryKey().defaultRandom(),
  classId: uuid("class_id").notNull(),                                         // 逻辑关联 classes.id
  teacherId: uuid("teacher_id").notNull(),                                     // 逻辑关联 users.id
  teacherRoleId: uuid("teacher_role_id"),                                      // 逻辑关联 teacher_roles.id，班级内角色（覆盖全局默认）
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

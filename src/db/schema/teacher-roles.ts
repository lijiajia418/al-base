import { pgTable, uuid, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const teacherRoles = pgTable("teacher_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull(),                                       // 逻辑关联 schools.id
  name: varchar("name", { length: 50 }).notNull(),                             // 角色名称（主讲老师、助教老师）
  code: varchar("code", { length: 50 }).notNull(),                             // 角色编码（instructor、assistant）
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),                     // 系统预置角色不可删除
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

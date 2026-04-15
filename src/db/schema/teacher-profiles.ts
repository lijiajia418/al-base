import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const teacherProfiles = pgTable("teacher_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(),                                  // 逻辑关联 users.id
  teacherRoleId: uuid("teacher_role_id"),                                      // 逻辑关联 teacher_roles.id，全局默认职能角色
  title: varchar("title", { length: 50 }),
  subjects: text("subjects").array().notNull().default(sql`'{}'::text[]`),
  employmentStatus: varchar("employment_status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

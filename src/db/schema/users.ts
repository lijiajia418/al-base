import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull(),                                       // 逻辑关联 schools.id
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  email: varchar("email", { length: 255 }).unique(),
  name: varchar("name", { length: 50 }).notNull(),
  avatarUrl: text("avatar_url"),
  roles: text("roles").array().notNull().default(sql`'{}'::text[]`),           // school_admin/teacher/student/parent
  status: varchar("status", { length: 20 }).notNull().default("active"),       // active/pending_activation/inactive/suspended
  passwordHash: varchar("password_hash", { length: 255 }),                     // 预留，MVP 不用
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdBy: uuid("created_by"),                                               // 逻辑关联 users.id
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

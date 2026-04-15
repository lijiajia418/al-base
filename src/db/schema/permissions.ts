import { pgTable, uuid, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 50 }).notNull().unique(),                    // 权限编码（class:create, task:assign）
  name: varchar("name", { length: 100 }).notNull(),                            // 权限名称（创建班级、布置任务）
  scope: varchar("scope", { length: 20 }).notNull(),                           // global（学校级）/ class（班级级）
  category: varchar("category", { length: 50 }).notNull(),                     // 权限分类：class / student / task / report
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

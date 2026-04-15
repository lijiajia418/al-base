import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

export const classes = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull(),                                       // 逻辑关联 schools.id
  name: varchar("name", { length: 100 }).notNull(),
  grade: varchar("grade", { length: 20 }),
  academicYear: varchar("academic_year", { length: 20 }),
  stage: varchar("stage", { length: 20 }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdBy: uuid("created_by").notNull(),                                     // 逻辑关联 users.id
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

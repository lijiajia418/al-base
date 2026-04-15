import { pgTable, uuid, varchar, decimal, date, timestamp } from "drizzle-orm/pg-core";

export const studentProfiles = pgTable("student_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(),                                  // 逻辑关联 users.id
  grade: varchar("grade", { length: 20 }),
  targetScore: decimal("target_score", { precision: 3, scale: 1 }),
  examDate: date("exam_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

export const classStudents = pgTable("class_students", {
  id: uuid("id").primaryKey().defaultRandom(),
  classId: uuid("class_id").notNull(),                                         // 逻辑关联 classes.id
  studentId: uuid("student_id").notNull(),                                     // 逻辑关联 users.id
  groupName: varchar("group_name", { length: 50 }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

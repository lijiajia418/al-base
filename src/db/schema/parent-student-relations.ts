import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

export const parentStudentRelations = pgTable("parent_student_relations", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentId: uuid("parent_id").notNull(),                                       // 逻辑关联 users.id
  studentId: uuid("student_id").notNull(),                                     // 逻辑关联 users.id
  relationType: varchar("relation_type", { length: 20 }).notNull(),
  bindingStatus: varchar("binding_status", { length: 20 }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

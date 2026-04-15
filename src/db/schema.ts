import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

// ============================================================
// Students
// ============================================================
export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  school: text("school"),
  grade: text("grade"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  settings: jsonb("settings").default({}),
});

// ============================================================
// Sessions
// ============================================================
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  student_id: uuid("student_id").references(() => students.id),
  started_at: timestamp("started_at", { withTimezone: true }).defaultNow(),
  ended_at: timestamp("ended_at", { withTimezone: true }),
  metadata: jsonb("metadata").default({}),
});

import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

export const parentProfiles = pgTable("parent_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(),                                  // 逻辑关联 users.id
  relationType: varchar("relation_type", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

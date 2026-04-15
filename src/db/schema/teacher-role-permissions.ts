import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core";

export const teacherRolePermissions = pgTable("teacher_role_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  teacherRoleId: uuid("teacher_role_id").notNull(),                            // 逻辑关联 teacher_roles.id
  permissionId: uuid("permission_id").notNull(),                               // 逻辑关联 permissions.id
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

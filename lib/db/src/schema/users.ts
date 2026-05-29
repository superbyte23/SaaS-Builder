import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { branchesTable } from "./branches";

export const userRoleEnum = pgEnum("user_role", [
  "super_admin", "owner", "manager", "cashier", "inventory_staff", "accountant", "auditor"
]);
export const userStatusEnum = pgEnum("user_status", ["active", "inactive"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id),
  branchId: integer("branch_id").references(() => branchesTable.id),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("cashier"),
  status: userStatusEnum("user_status_val").notNull().default("active"),
  avatar: text("avatar"),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

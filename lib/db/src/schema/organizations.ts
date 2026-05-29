import { pgTable, serial, text, real, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const businessTypeEnum = pgEnum("business_type", [
  "retail", "grocery", "pharmacy", "restaurant", "cafe", "salon",
  "service", "hardware", "convenience", "wholesale", "boutique", "other"
]);

export const planEnum = pgEnum("plan", ["free", "starter", "professional", "enterprise", "trial"]);
export const orgStatusEnum = pgEnum("org_status", ["active", "suspended", "trial"]);

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  businessType: businessTypeEnum("business_type").notNull().default("retail"),
  logo: text("logo"),
  plan: planEnum("plan").notNull().default("trial"),
  status: orgStatusEnum("status").notNull().default("trial"),
  currency: text("currency").notNull().default("USD"),
  timezone: text("timezone").notNull().default("UTC"),
  taxRate: real("tax_rate").notNull().default(0),
  receiptHeader: text("receipt_header"),
  receiptFooter: text("receipt_footer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({ id: true, createdAt: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;

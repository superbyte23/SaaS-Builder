import { pgTable, serial, text, real, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { categoriesTable } from "./categories";

export const productStatusEnum = pgEnum("product_status", ["active", "inactive", "discontinued"]);

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id),
  categoryId: integer("category_id").references(() => categoriesTable.id),
  name: text("name").notNull(),
  description: text("description"),
  sku: text("sku"),
  barcode: text("barcode"),
  price: real("price").notNull(),
  costPrice: real("cost_price"),
  unit: text("unit").notNull().default("piece"),
  taxRate: real("tax_rate"),
  image: text("image"),
  trackInventory: boolean("track_inventory").notNull().default(true),
  reorderPoint: integer("reorder_point"),
  status: productStatusEnum("product_status_val").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;

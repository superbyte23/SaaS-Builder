import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable, productsTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/categories", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const cats = await db.select().from(categoriesTable).where(eq(categoriesTable.organizationId, orgId));
  const result = await Promise.all(cats.map(async (cat) => {
    const [{ productCount }] = await db.select({ productCount: count() }).from(productsTable).where(and(eq(productsTable.categoryId, cat.id), eq(productsTable.organizationId, orgId)));
    return { ...cat, productCount: Number(productCount) };
  }));
  res.json(result);
});

router.post("/categories", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const { name, description, color, icon } = req.body;
  if (!name) { res.status(400).json({ error: "Name is required" }); return; }
  const [cat] = await db.insert(categoriesTable).values({ organizationId: orgId, name, description, color, icon }).returning();
  res.status(201).json({ ...cat, productCount: 0 });
});

router.patch("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name, description, color, icon } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (color !== undefined) updates.color = color;
  if (icon !== undefined) updates.icon = icon;
  const [cat] = await db.update(categoriesTable).set(updates).where(and(eq(categoriesTable.id, id), eq(categoriesTable.organizationId, req.organizationId!))).returning();
  if (!cat) { res.status(404).json({ error: "Not found" }); return; }
  const [{ productCount }] = await db.select({ productCount: count() }).from(productsTable).where(eq(productsTable.categoryId, id));
  res.json({ ...cat, productCount: Number(productCount) });
});

router.delete("/categories/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(categoriesTable).where(and(eq(categoriesTable.id, id), eq(categoriesTable.organizationId, req.organizationId!)));
  res.json({ success: true });
});

export default router;

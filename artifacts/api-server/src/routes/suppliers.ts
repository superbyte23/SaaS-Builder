import { Router } from "express";
import { db } from "@workspace/db";
import { suppliersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/suppliers", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const suppliers = await db.select().from(suppliersTable).where(eq(suppliersTable.organizationId, orgId));
  res.json(suppliers);
});

router.post("/suppliers", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const { name, contactPerson, email, phone, address, notes } = req.body;
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const [supplier] = await db.insert(suppliersTable).values({ organizationId: orgId, name, contactPerson, email, phone, address, notes }).returning();
  res.status(201).json(supplier);
});

router.patch("/suppliers/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const updates: Record<string, unknown> = {};
  const fields = ["name","contactPerson","email","phone","address","notes"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  const [supplier] = await db.update(suppliersTable).set(updates).where(and(eq(suppliersTable.id, id), eq(suppliersTable.organizationId, req.organizationId!))).returning();
  if (!supplier) { res.status(404).json({ error: "Not found" }); return; }
  res.json(supplier);
});

router.delete("/suppliers/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(suppliersTable).where(and(eq(suppliersTable.id, id), eq(suppliersTable.organizationId, req.organizationId!)));
  res.json({ success: true });
});

export default router;

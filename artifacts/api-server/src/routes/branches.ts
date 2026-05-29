import { Router } from "express";
import { db } from "@workspace/db";
import { branchesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/branches", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const branches = await db.select().from(branchesTable).where(eq(branchesTable.organizationId, orgId));
  res.json(branches);
});

router.post("/branches", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const { name, address, phone, email, isMain, taxRate } = req.body;
  if (!name) { res.status(400).json({ error: "Name is required" }); return; }
  const [branch] = await db.insert(branchesTable).values({
    organizationId: orgId,
    name,
    address,
    phone,
    email,
    isMain: isMain || false,
    taxRate,
    status: "active",
  }).returning();
  res.status(201).json(branch);
});

router.get("/branches/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [branch] = await db.select().from(branchesTable).where(and(eq(branchesTable.id, id), eq(branchesTable.organizationId, req.organizationId!)));
  if (!branch) { res.status(404).json({ error: "Not found" }); return; }
  res.json(branch);
});

router.patch("/branches/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name, address, phone, email, status, taxRate } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (address !== undefined) updates.address = address;
  if (phone !== undefined) updates.phone = phone;
  if (email !== undefined) updates.email = email;
  if (status !== undefined) updates.status = status;
  if (taxRate !== undefined) updates.taxRate = taxRate;
  const [branch] = await db.update(branchesTable).set(updates).where(and(eq(branchesTable.id, id), eq(branchesTable.organizationId, req.organizationId!))).returning();
  if (!branch) { res.status(404).json({ error: "Not found" }); return; }
  res.json(branch);
});

router.delete("/branches/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(branchesTable).where(and(eq(branchesTable.id, id), eq(branchesTable.organizationId, req.organizationId!)));
  res.json({ success: true });
});

export default router;

import { Router } from "express";
import { db } from "@workspace/db";
import { organizationsTable, branchesTable, usersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/organizations", requireAuth, async (req, res): Promise<void> => {
  const orgs = await db.select().from(organizationsTable);
  const result = await Promise.all(
    orgs.map(async (org) => {
      const [{ branchCount }] = await db.select({ branchCount: count() }).from(branchesTable).where(eq(branchesTable.organizationId, org.id));
      const [{ userCount }] = await db.select({ userCount: count() }).from(usersTable).where(eq(usersTable.organizationId, org.id));
      return { ...org, branchCount: Number(branchCount), userCount: Number(userCount) };
    })
  );
  res.json(result);
});

router.post("/organizations", requireAuth, async (req, res): Promise<void> => {
  const { name, businessType, currency, timezone, taxRate, plan } = req.body;
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const [org] = await db.insert(organizationsTable).values({
    name,
    businessType: businessType || "retail",
    currency: currency || "USD",
    timezone: timezone || "UTC",
    taxRate: taxRate || 0,
    plan: plan || "free",
    status: "trial",
  }).returning();
  res.status(201).json({ ...org, branchCount: 0, userCount: 0 });
});

router.get("/organizations/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id));
  if (!org) { res.status(404).json({ error: "Not found" }); return; }
  const [{ branchCount }] = await db.select({ branchCount: count() }).from(branchesTable).where(eq(branchesTable.organizationId, id));
  const [{ userCount }] = await db.select({ userCount: count() }).from(usersTable).where(eq(usersTable.organizationId, id));
  res.json({ ...org, branchCount: Number(branchCount), userCount: Number(userCount) });
});

router.patch("/organizations/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name, businessType, currency, timezone, taxRate, receiptHeader, receiptFooter, plan, status } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (businessType !== undefined) updates.businessType = businessType;
  if (currency !== undefined) updates.currency = currency;
  if (timezone !== undefined) updates.timezone = timezone;
  if (taxRate !== undefined) updates.taxRate = taxRate;
  if (receiptHeader !== undefined) updates.receiptHeader = receiptHeader;
  if (receiptFooter !== undefined) updates.receiptFooter = receiptFooter;
  if (plan !== undefined) updates.plan = plan;
  if (status !== undefined) updates.status = status;
  const [org] = await db.update(organizationsTable).set(updates).where(eq(organizationsTable.id, id)).returning();
  if (!org) { res.status(404).json({ error: "Not found" }); return; }
  const [{ branchCount }] = await db.select({ branchCount: count() }).from(branchesTable).where(eq(branchesTable.organizationId, id));
  const [{ userCount }] = await db.select({ userCount: count() }).from(usersTable).where(eq(usersTable.organizationId, id));
  res.json({ ...org, branchCount: Number(branchCount), userCount: Number(userCount) });
});

export default router;

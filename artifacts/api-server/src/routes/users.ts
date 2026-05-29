import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, branchesTable, ordersTable } from "@workspace/db";
import { eq, and, sum } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { hashPassword } from "../lib/auth";

const router = Router();

router.get("/users", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const users = await db.select({
    user: usersTable,
    branchName: branchesTable.name,
  }).from(usersTable)
    .leftJoin(branchesTable, eq(usersTable.branchId, branchesTable.id))
    .where(eq(usersTable.organizationId, orgId));

  const result = users.map(({ user, branchName }) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    branchId: user.branchId,
    branchName: branchName || null,
    status: user.status,
    avatar: user.avatar,
    phone: user.phone,
    totalSales: null,
    createdAt: user.createdAt,
  }));
  res.json(result);
});

router.post("/users", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const { name, email, password, role, branchId, phone } = req.body;
  if (!name || !email || !password || !role) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) { res.status(400).json({ error: "Email already in use" }); return; }

  const [user] = await db.insert(usersTable).values({
    organizationId: orgId,
    name,
    email,
    passwordHash: hashPassword(password),
    role,
    branchId: branchId || null,
    phone,
    status: "active",
  }).returning();

  res.status(201).json({ ...user, branchName: null, totalSales: null, passwordHash: undefined });
});

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [result] = await db.select({ user: usersTable, branchName: branchesTable.name })
    .from(usersTable).leftJoin(branchesTable, eq(usersTable.branchId, branchesTable.id))
    .where(and(eq(usersTable.id, id), eq(usersTable.organizationId, req.organizationId!)));
  if (!result) { res.status(404).json({ error: "Not found" }); return; }
  const { user, branchName } = result;
  res.json({ ...user, branchName: branchName || null, totalSales: null, passwordHash: undefined });
});

router.patch("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name, role, branchId, phone, status } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (role !== undefined) updates.role = role;
  if (branchId !== undefined) updates.branchId = branchId;
  if (phone !== undefined) updates.phone = phone;
  if (status !== undefined) updates.status = status;
  const [user] = await db.update(usersTable).set(updates).where(and(eq(usersTable.id, id), eq(usersTable.organizationId, req.organizationId!))).returning();
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...user, branchName: null, totalSales: null, passwordHash: undefined });
});

router.delete("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(usersTable).where(and(eq(usersTable.id, id), eq(usersTable.organizationId, req.organizationId!)));
  res.json({ success: true });
});

export default router;

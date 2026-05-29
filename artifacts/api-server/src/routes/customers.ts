import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, ordersTable, orderItemsTable, usersTable, branchesTable } from "@workspace/db";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/customers", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const { search } = req.query;
  const customers = await db.select().from(customersTable).where(eq(customersTable.organizationId, orgId)).orderBy(desc(customersTable.createdAt));
  const filtered = search
    ? customers.filter(c => c.name.toLowerCase().includes((search as string).toLowerCase()) || (c.email || "").toLowerCase().includes((search as string).toLowerCase()) || (c.phone || "").includes(search as string))
    : customers;
  res.json(filtered);
});

router.post("/customers", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const { name, email, phone, address, birthday, notes } = req.body;
  if (!name) { res.status(400).json({ error: "Name required" }); return; }
  const [customer] = await db.insert(customersTable).values({
    organizationId: orgId, name, email, phone, address, birthday, notes,
    loyaltyPoints: 0, totalSpent: 0, orderCount: 0,
  }).returning();
  res.status(201).json(customer);
});

router.get("/customers/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [customer] = await db.select().from(customersTable).where(and(eq(customersTable.id, id), eq(customersTable.organizationId, req.organizationId!)));
  if (!customer) { res.status(404).json({ error: "Not found" }); return; }
  res.json(customer);
});

router.patch("/customers/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const updates: Record<string, unknown> = {};
  const fields = ["name","email","phone","address","birthday","notes"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  const [customer] = await db.update(customersTable).set(updates).where(and(eq(customersTable.id, id), eq(customersTable.organizationId, req.organizationId!))).returning();
  if (!customer) { res.status(404).json({ error: "Not found" }); return; }
  res.json(customer);
});

router.delete("/customers/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(customersTable).where(and(eq(customersTable.id, id), eq(customersTable.organizationId, req.organizationId!)));
  res.json({ success: true });
});

router.get("/customers/:id/orders", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const customerId = parseInt(raw, 10);
  const orders = await db.select({
    order: ordersTable,
    branchName: branchesTable.name,
    cashierName: usersTable.name,
  }).from(ordersTable)
    .leftJoin(branchesTable, eq(ordersTable.branchId, branchesTable.id))
    .leftJoin(usersTable, eq(ordersTable.cashierId, usersTable.id))
    .where(eq(ordersTable.customerId, customerId))
    .orderBy(desc(ordersTable.createdAt))
    .limit(50);

  const result = await Promise.all(orders.map(async ({ order, branchName, cashierName }) => {
    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
    return { ...order, branchName: branchName || "", cashierName: cashierName || "", items: items.map(i => ({ ...i, productName: "" })) };
  }));
  res.json(result);
});

export default router;

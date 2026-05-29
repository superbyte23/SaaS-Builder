import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, productsTable, branchesTable, usersTable, customersTable, inventoryTable } from "@workspace/db";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function generateOrderNumber(): string {
  const now = new Date();
  const prefix = `ORD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${suffix}`;
}

async function buildOrderResponse(order: typeof ordersTable.$inferSelect) {
  const items = await db.select({
    item: orderItemsTable,
    productName: productsTable.name,
  }).from(orderItemsTable)
    .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
    .where(eq(orderItemsTable.orderId, order.id));

  const [branch] = await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, order.branchId));
  const [cashier] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, order.cashierId));
  let customerName = null;
  if (order.customerId) {
    const [cust] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, order.customerId));
    customerName = cust?.name ?? null;
  }

  return {
    ...order,
    branchName: branch?.name ?? "",
    cashierName: cashier?.name ?? "",
    customerName,
    items: items.map(({ item, productName }) => ({
      id: item.id,
      productId: item.productId,
      productName: productName ?? "",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      totalPrice: item.totalPrice,
      notes: item.notes ?? null,
    })),
  };
}

router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const { branchId, customerId, status, from, to } = req.query;
  const orgId = req.organizationId!;

  const branches = await db.select({ id: branchesTable.id }).from(branchesTable).where(eq(branchesTable.organizationId, orgId));
  const branchIds = branches.map(b => b.id);

  let orders = await db.select().from(ordersTable)
    .where(and(
      branchId ? eq(ordersTable.branchId, parseInt(branchId as string, 10)) : sql`${ordersTable.branchId} = ANY(${sql`ARRAY[${sql.join(branchIds.map(id => sql`${id}`), sql`, `)}]::int[]`})`,
      customerId ? eq(ordersTable.customerId, parseInt(customerId as string, 10)) : undefined,
      status ? eq(ordersTable.status, status as any) : undefined,
      from ? gte(ordersTable.createdAt, new Date(from as string)) : undefined,
      to ? lte(ordersTable.createdAt, new Date(to as string)) : undefined,
    ))
    .orderBy(desc(ordersTable.createdAt))
    .limit(100);

  const result = await Promise.all(orders.map(buildOrderResponse));
  res.json(result);
});

router.post("/orders", requireAuth, async (req, res): Promise<void> => {
  const { branchId, customerId, items, discountAmount, notes } = req.body;
  if (!branchId || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "branchId and items are required" });
    return;
  }

  let subtotal = 0;
  for (const item of items) {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.unitPrice) || 0;
    const disc = Number(item.discount) || 0;
    subtotal += (price * qty) - disc;
  }
  const discount = Number(discountAmount) || 0;
  const taxRate = 0.08;
  const taxAmount = (subtotal - discount) * taxRate;
  const total = subtotal - discount + taxAmount;

  const [order] = await db.insert(ordersTable).values({
    orderNumber: generateOrderNumber(),
    branchId,
    customerId: customerId || null,
    cashierId: req.userId!,
    status: "draft",
    subtotal,
    discountAmount: discount,
    taxAmount,
    total,
    notes: notes || null,
  }).returning();

  for (const item of items) {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.unitPrice) || 0;
    const disc = Number(item.discount) || 0;
    await db.insert(orderItemsTable).values({
      orderId: order.id,
      productId: item.productId,
      quantity: qty,
      unitPrice: price,
      discount: disc,
      totalPrice: (price * qty) - disc,
      notes: item.notes || null,
    });
  }

  const result = await buildOrderResponse(order);
  res.status(201).json(result);
});

router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildOrderResponse(order));
});

router.patch("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { status, notes, customerId, discountAmount, items } = req.body;
  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  if (customerId !== undefined) updates.customerId = customerId;
  if (discountAmount !== undefined) {
    updates.discountAmount = discountAmount;
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (order) {
      updates.total = order.subtotal - discountAmount + order.taxAmount;
    }
  }
  if (items && Array.isArray(items)) {
    await db.delete(orderItemsTable).where(eq(orderItemsTable.orderId, id));
    let subtotal = 0;
    for (const item of items) {
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unitPrice) || 0;
      const disc = Number(item.discount) || 0;
      subtotal += (price * qty) - disc;
      await db.insert(orderItemsTable).values({ orderId: id, productId: item.productId, quantity: qty, unitPrice: price, discount: disc, totalPrice: (price * qty) - disc, notes: item.notes || null });
    }
    updates.subtotal = subtotal;
    const disc = Number(discountAmount) || 0;
    const taxAmount = (subtotal - disc) * 0.08;
    updates.taxAmount = taxAmount;
    updates.total = subtotal - disc + taxAmount;
  }
  const [order] = await db.update(ordersTable).set(updates).where(eq(ordersTable.id, id)).returning();
  if (!order) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildOrderResponse(order));
});

router.post("/orders/:id/complete", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { paymentMethod, amountPaid } = req.body;
  if (!paymentMethod || amountPaid == null) {
    res.status(400).json({ error: "paymentMethod and amountPaid are required" });
    return;
  }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "Not found" }); return; }
  if (order.status === "completed") { res.status(400).json({ error: "Order already completed" }); return; }

  const change = Number(amountPaid) - order.total;

  const [updated] = await db.update(ordersTable).set({
    status: "completed",
    paymentMethod,
    amountPaid: Number(amountPaid),
    change: Math.max(0, change),
    completedAt: new Date(),
  }).where(eq(ordersTable.id, id)).returning();

  // Deduct inventory
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, id));
  for (const item of items) {
    const existing = await db.select().from(inventoryTable).where(and(eq(inventoryTable.productId, item.productId), eq(inventoryTable.branchId, order.branchId)));
    if (existing.length > 0) {
      await db.update(inventoryTable).set({
        quantity: sql`${inventoryTable.quantity} - ${item.quantity}`,
        updatedAt: new Date(),
      }).where(and(eq(inventoryTable.productId, item.productId), eq(inventoryTable.branchId, order.branchId)));
    }
  }

  // Update customer stats
  if (order.customerId) {
    await db.update(customersTable).set({
      totalSpent: sql`${customersTable.totalSpent} + ${order.total}`,
      orderCount: sql`${customersTable.orderCount} + 1`,
      loyaltyPoints: sql`${customersTable.loyaltyPoints} + ${Math.floor(order.total)}`,
    }).where(eq(customersTable.id, order.customerId));
  }

  res.json(await buildOrderResponse(updated));
});

router.post("/orders/:id/refund", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { reason } = req.body;
  const [order] = await db.update(ordersTable).set({ status: "refunded", notes: reason || "Refunded" }).where(eq(ordersTable.id, id)).returning();
  if (!order) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildOrderResponse(order));
});

export default router;

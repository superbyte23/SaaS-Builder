import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, productsTable, branchesTable, inventoryTable } from "@workspace/db";
import { eq, and, sql, gte, lte, sum, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/reports/sales", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const { from, to, groupBy = "day" } = req.query;

  const branches = await db.select({ id: branchesTable.id }).from(branchesTable).where(eq(branchesTable.organizationId, orgId));
  const branchIds = branches.map(b => b.id);
  if (branchIds.length === 0) {
    res.json({ totalRevenue: 0, totalOrders: 0, totalItems: 0, grossProfit: 0, averageOrderValue: 0, data: [] });
    return;
  }

  const fromDate = from ? new Date(from as string) : new Date(Date.now() - 30 * 86400000);
  const toDate = to ? new Date(to as string) : new Date();

  const orders = await db.select().from(ordersTable).where(and(
    sql`${ordersTable.branchId} = ANY(ARRAY[${sql.raw(branchIds.join(","))}]::int[])`,
    eq(ordersTable.status, "completed"),
    gte(ordersTable.createdAt, fromDate),
    lte(ordersTable.createdAt, toDate),
  ));

  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const totalOrders = orders.length;

  const allItems = await db.select({ qty: sum(orderItemsTable.quantity) })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(and(
      sql`${ordersTable.branchId} = ANY(ARRAY[${sql.raw(branchIds.join(","))}]::int[])`,
      eq(ordersTable.status, "completed"),
      gte(ordersTable.createdAt, fromDate),
      lte(ordersTable.createdAt, toDate),
    ));
  const totalItems = Number(allItems[0]?.qty ?? 0);

  // Group by
  const groups = new Map<string, { revenue: number; orders: number }>();
  for (const order of orders) {
    let label: string;
    const d = new Date(order.createdAt);
    if (groupBy === "month") {
      label = d.toLocaleString("default", { month: "short", year: "numeric" });
    } else if (groupBy === "week") {
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    } else {
      label = `${d.getMonth() + 1}/${d.getDate()}`;
    }
    const g = groups.get(label) || { revenue: 0, orders: 0 };
    g.revenue += order.total;
    g.orders += 1;
    groups.set(label, g);
  }

  const data = Array.from(groups.entries()).map(([label, { revenue, orders }]) => ({ label, revenue, orders }));

  res.json({
    totalRevenue,
    totalOrders,
    totalItems,
    grossProfit: totalRevenue * 0.35,
    averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    data,
  });
});

router.get("/reports/inventory-valuation", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const { branchId } = req.query;

  const products = await db.select({
    prod: productsTable,
  }).from(productsTable).where(and(eq(productsTable.organizationId, orgId), eq(productsTable.status, "active")));

  let totalValue = 0;
  let totalItems = 0;
  const data = [];

  for (const { prod } of products) {
    const [invRow] = await db.select({ qty: sum(inventoryTable.quantity) })
      .from(inventoryTable)
      .where(and(
        eq(inventoryTable.productId, prod.id),
        branchId ? eq(inventoryTable.branchId, parseInt(branchId as string, 10)) : undefined,
      ));
    const qty = Number(invRow?.qty ?? 0);
    const cost = prod.costPrice || prod.price * 0.6;
    const val = qty * cost;
    totalValue += val;
    totalItems += qty;
    data.push({
      productId: prod.id,
      productName: prod.name,
      categoryName: null,
      quantity: qty,
      costPrice: cost,
      salePrice: prod.price,
      totalValue: val,
    });
  }

  res.json({ totalValue, totalItems, data: data.sort((a, b) => b.totalValue - a.totalValue) });
});

export default router;

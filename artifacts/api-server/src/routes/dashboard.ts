import { Router } from "express";
import { db } from "@workspace/db";
import { ordersTable, orderItemsTable, productsTable, customersTable, branchesTable, inventoryTable } from "@workspace/db";
import { eq, and, sql, desc, gte, sum, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function getPeriodDates(period: string): { from: Date; compareFrom: Date } {
  const now = new Date();
  let from: Date;
  let compareFrom: Date;
  switch (period) {
    case "today":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      compareFrom = new Date(from.getTime() - 86400000);
      break;
    case "week":
      from = new Date(now.getTime() - 7 * 86400000);
      compareFrom = new Date(now.getTime() - 14 * 86400000);
      break;
    case "year":
      from = new Date(now.getFullYear(), 0, 1);
      compareFrom = new Date(now.getFullYear() - 1, 0, 1);
      break;
    default: // month
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      compareFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  }
  return { from, compareFrom };
}

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const { period = "month" } = req.query;
  const { from, compareFrom } = getPeriodDates(period as string);

  const branches = await db.select({ id: branchesTable.id }).from(branchesTable).where(eq(branchesTable.organizationId, orgId));
  const branchIds = branches.map(b => b.id);
  if (branchIds.length === 0) {
    res.json({ totalRevenue: 0, totalOrders: 0, totalCustomers: 0, totalProducts: 0, avgOrderValue: 0, revenueChange: 0, ordersChange: 0, customersChange: 0, lowStockCount: 0, pendingRefunds: 0 });
    return;
  }

  const branchFilter = sql`${ordersTable.branchId} = ANY(ARRAY[${sql.raw(branchIds.join(","))}]::int[])`;
  const completedStatus = sql`${ordersTable.status} = 'completed'`;

  const [revRow] = await db.select({ total: sum(ordersTable.total), cnt: count() })
    .from(ordersTable).where(and(branchFilter, completedStatus, gte(ordersTable.createdAt, from)));

  const [prevRevRow] = await db.select({ total: sum(ordersTable.total), cnt: count() })
    .from(ordersTable).where(and(branchFilter, completedStatus, gte(ordersTable.createdAt, compareFrom), sql`${ordersTable.createdAt} < ${from}`));

  const [custRow] = await db.select({ cnt: count() }).from(customersTable).where(and(eq(customersTable.organizationId, orgId), gte(customersTable.createdAt, from)));
  const [prevCustRow] = await db.select({ cnt: count() }).from(customersTable).where(and(eq(customersTable.organizationId, orgId), gte(customersTable.createdAt, compareFrom), sql`${customersTable.createdAt} < ${from}`));

  const [prodRow] = await db.select({ cnt: count() }).from(productsTable).where(and(eq(productsTable.organizationId, orgId), eq(productsTable.status, "active")));

  const totalRevenue = Number(revRow?.total ?? 0);
  const prevRevenue = Number(prevRevRow?.total ?? 0);
  const totalOrders = Number(revRow?.cnt ?? 0);
  const prevOrders = Number(prevRevRow?.cnt ?? 0);
  const newCustomers = Number(custRow?.cnt ?? 0);
  const prevCustomers = Number(prevCustRow?.cnt ?? 0);

  const [allCustRow] = await db.select({ cnt: count() }).from(customersTable).where(eq(customersTable.organizationId, orgId));

  // Low stock
  const invRows = await db.select({ inv: inventoryTable, reorderPoint: productsTable.reorderPoint })
    .from(inventoryTable)
    .innerJoin(productsTable, eq(inventoryTable.productId, productsTable.id))
    .where(and(eq(productsTable.organizationId, orgId), eq(productsTable.trackInventory, true)));
  const lowStockCount = invRows.filter(r => r.reorderPoint && r.inv.quantity <= r.reorderPoint).length;

  res.json({
    totalRevenue,
    totalOrders,
    totalCustomers: Number(allCustRow?.cnt ?? 0),
    totalProducts: Number(prodRow?.cnt ?? 0),
    avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    revenueChange: prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0,
    ordersChange: prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders) * 100 : 0,
    customersChange: prevCustomers > 0 ? ((newCustomers - prevCustomers) / prevCustomers) * 100 : 0,
    lowStockCount,
    pendingRefunds: 0,
  });
});

router.get("/dashboard/sales-chart", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const { period = "month" } = req.query;

  const branches = await db.select({ id: branchesTable.id }).from(branchesTable).where(eq(branchesTable.organizationId, orgId));
  const branchIds = branches.map(b => b.id);
  if (branchIds.length === 0) { res.json([]); return; }

  const now = new Date();
  let days = period === "week" ? 7 : period === "year" ? 12 : 30;
  const result = [];

  if (period === "year") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = d.toLocaleString("default", { month: "short" });
      const [row] = await db.select({ total: sum(ordersTable.total), cnt: count() })
        .from(ordersTable).where(and(
          sql`${ordersTable.branchId} = ANY(ARRAY[${sql.raw(branchIds.join(","))}]::int[])`,
          eq(ordersTable.status, "completed"),
          gte(ordersTable.createdAt, d),
          sql`${ordersTable.createdAt} < ${end}`,
        ));
      result.push({ label, revenue: Number(row?.total ?? 0), orders: Number(row?.cnt ?? 0) });
    }
  } else {
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d.getTime() + 86400000);
      const label = period === "week" ? d.toLocaleString("default", { weekday: "short" }) : `${d.getMonth() + 1}/${d.getDate()}`;
      const [row] = await db.select({ total: sum(ordersTable.total), cnt: count() })
        .from(ordersTable).where(and(
          sql`${ordersTable.branchId} = ANY(ARRAY[${sql.raw(branchIds.join(","))}]::int[])`,
          eq(ordersTable.status, "completed"),
          gte(ordersTable.createdAt, d),
          sql`${ordersTable.createdAt} < ${end}`,
        ));
      result.push({ label, revenue: Number(row?.total ?? 0), orders: Number(row?.cnt ?? 0) });
    }
  }
  res.json(result);
});

router.get("/dashboard/top-products", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const limit = parseInt((req.query.limit as string) || "10", 10);

  const branches = await db.select({ id: branchesTable.id }).from(branchesTable).where(eq(branchesTable.organizationId, orgId));
  const branchIds = branches.map(b => b.id);
  if (branchIds.length === 0) { res.json([]); return; }

  const rows = await db.select({
    productId: orderItemsTable.productId,
    totalSold: sum(orderItemsTable.quantity),
    revenue: sum(orderItemsTable.totalPrice),
  }).from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(and(
      sql`${ordersTable.branchId} = ANY(ARRAY[${sql.raw(branchIds.join(","))}]::int[])`,
      eq(ordersTable.status, "completed"),
    ))
    .groupBy(orderItemsTable.productId)
    .orderBy(sql`sum(${orderItemsTable.totalPrice}) DESC`)
    .limit(limit);

  const result = await Promise.all(rows.map(async (row) => {
    const [prod] = await db.select({ name: productsTable.name, categoryId: productsTable.categoryId }).from(productsTable).where(eq(productsTable.id, row.productId!));
    return {
      productId: row.productId,
      productName: prod?.name ?? "",
      categoryName: null,
      totalSold: Number(row.totalSold ?? 0),
      revenue: Number(row.revenue ?? 0),
    };
  }));
  res.json(result);
});

router.get("/dashboard/recent-orders", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const limit = parseInt((req.query.limit as string) || "10", 10);

  const branches = await db.select({ id: branchesTable.id }).from(branchesTable).where(eq(branchesTable.organizationId, orgId));
  const branchIds = branches.map(b => b.id);
  if (branchIds.length === 0) { res.json([]); return; }

  const orders = await db.select().from(ordersTable)
    .where(sql`${ordersTable.branchId} = ANY(ARRAY[${sql.raw(branchIds.join(","))}]::int[])`)
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit);

  const { usersTable } = await import("@workspace/db");
  const result = await Promise.all(orders.map(async (order) => {
    const [branch] = await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, order.branchId));
    const [cashierRow] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, order.cashierId));
    const cashierName = cashierRow?.name ?? "";
    let customerName = null;
    if (order.customerId) {
      const [cust] = await db.select({ name: customersTable.name }).from(customersTable).where(eq(customersTable.id, order.customerId));
      customerName = cust?.name ?? null;
    }
    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
    return { ...order, branchName: branch?.name ?? "", cashierName, customerName, items: items.map(i => ({ ...i, productName: "" })) };
  }));
  res.json(result);
});

router.get("/dashboard/low-stock-alerts", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const branches = await db.select({ id: branchesTable.id, name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.organizationId, orgId));
  const branchIds = branches.map(b => b.id);
  if (branchIds.length === 0) { res.json([]); return; }

  const rows = await db.select({
    inv: inventoryTable,
    productName: productsTable.name,
    reorderPoint: productsTable.reorderPoint,
    trackInventory: productsTable.trackInventory,
  }).from(inventoryTable)
    .innerJoin(productsTable, eq(inventoryTable.productId, productsTable.id))
    .where(and(
      eq(productsTable.organizationId, orgId),
      eq(productsTable.trackInventory, true),
    ));

  const alerts = rows
    .filter(r => r.reorderPoint != null && r.inv.quantity <= r.reorderPoint)
    .map(r => {
      const branch = branches.find(b => b.id === r.inv.branchId);
      return {
        productId: r.inv.productId,
        productName: r.productName,
        branchId: r.inv.branchId,
        branchName: branch?.name ?? "",
        currentStock: r.inv.quantity,
        reorderPoint: r.reorderPoint!,
      };
    });

  res.json(alerts);
});

export default router;

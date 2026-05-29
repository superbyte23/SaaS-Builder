import { Router } from "express";
import { db } from "@workspace/db";
import { inventoryTable, inventoryMovementsTable, productsTable, branchesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/inventory", requireAuth, async (req, res): Promise<void> => {
  const { branchId, productId } = req.query;
  const orgId = req.organizationId!;

  const rows = await db.select({
    inv: inventoryTable,
    productName: productsTable.name,
    productSku: productsTable.sku,
    reorderPoint: productsTable.reorderPoint,
    branchName: branchesTable.name,
  }).from(inventoryTable)
    .innerJoin(productsTable, eq(inventoryTable.productId, productsTable.id))
    .innerJoin(branchesTable, eq(inventoryTable.branchId, branchesTable.id))
    .where(and(
      eq(productsTable.organizationId, orgId),
      branchId ? eq(inventoryTable.branchId, parseInt(branchId as string, 10)) : undefined,
      productId ? eq(inventoryTable.productId, parseInt(productId as string, 10)) : undefined,
    ));

  res.json(rows.map(({ inv, productName, productSku, reorderPoint, branchName }) => ({
    id: inv.id,
    productId: inv.productId,
    productName,
    productSku: productSku || null,
    branchId: inv.branchId,
    branchName,
    quantity: inv.quantity,
    reorderPoint: reorderPoint || null,
    updatedAt: inv.updatedAt,
  })));
});

router.post("/inventory/adjust", requireAuth, async (req, res): Promise<void> => {
  const { productId, branchId, quantity, reason, notes } = req.body;
  if (!productId || !branchId || quantity == null || !reason) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const existing = await db.select().from(inventoryTable)
    .where(and(eq(inventoryTable.productId, productId), eq(inventoryTable.branchId, branchId)));

  let inv;
  if (existing.length > 0) {
    [inv] = await db.update(inventoryTable)
      .set({ quantity: sql`${inventoryTable.quantity} + ${quantity}`, updatedAt: new Date() })
      .where(and(eq(inventoryTable.productId, productId), eq(inventoryTable.branchId, branchId)))
      .returning();
  } else {
    [inv] = await db.insert(inventoryTable).values({ productId, branchId, quantity }).returning();
  }

  await db.insert(inventoryMovementsTable).values({ productId, branchId, quantity, reason, notes: notes || null });

  const [product] = await db.select({ name: productsTable.name, sku: productsTable.sku, reorderPoint: productsTable.reorderPoint }).from(productsTable).where(eq(productsTable.id, productId));
  const [branch] = await db.select({ name: branchesTable.name }).from(branchesTable).where(eq(branchesTable.id, branchId));

  res.json({
    id: inv.id,
    productId: inv.productId,
    productName: product?.name ?? "",
    productSku: product?.sku ?? null,
    branchId: inv.branchId,
    branchName: branch?.name ?? "",
    quantity: inv.quantity,
    reorderPoint: product?.reorderPoint ?? null,
    updatedAt: inv.updatedAt,
  });
});

router.get("/inventory/movements", requireAuth, async (req, res): Promise<void> => {
  const { branchId, productId } = req.query;
  const orgId = req.organizationId!;

  const rows = await db.select({
    mov: inventoryMovementsTable,
    productName: productsTable.name,
    branchName: branchesTable.name,
  }).from(inventoryMovementsTable)
    .innerJoin(productsTable, eq(inventoryMovementsTable.productId, productsTable.id))
    .innerJoin(branchesTable, eq(inventoryMovementsTable.branchId, branchesTable.id))
    .where(and(
      eq(productsTable.organizationId, orgId),
      branchId ? eq(inventoryMovementsTable.branchId, parseInt(branchId as string, 10)) : undefined,
      productId ? eq(inventoryMovementsTable.productId, parseInt(productId as string, 10)) : undefined,
    ))
    .orderBy(sql`${inventoryMovementsTable.createdAt} DESC`)
    .limit(200);

  res.json(rows.map(({ mov, productName, branchName }) => ({
    id: mov.id,
    productId: mov.productId,
    productName,
    branchId: mov.branchId,
    branchName,
    quantity: mov.quantity,
    reason: mov.reason,
    notes: mov.notes || null,
    referenceId: mov.referenceId || null,
    createdAt: mov.createdAt,
  })));
});

export default router;

import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, categoriesTable, inventoryTable, suppliersTable } from "@workspace/db";
import { eq, and, sum } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/products/barcode/:barcode", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const barcode = Array.isArray(req.params.barcode) ? req.params.barcode[0] : req.params.barcode;
  const [result] = await db
    .select({ product: productsTable, categoryName: categoriesTable.name, supplierName: suppliersTable.name })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .where(and(eq(productsTable.barcode, barcode), eq(productsTable.organizationId, orgId)));
  if (!result) { res.status(404).json({ error: "Product not found" }); return; }
  const inv = await db.select({ qty: sum(inventoryTable.quantity) }).from(inventoryTable).where(eq(inventoryTable.productId, result.product.id));
  res.json({ ...result.product, categoryName: result.categoryName ?? null, supplierName: result.supplierName ?? null, stockQuantity: Number(inv[0]?.qty ?? 0) });
});

router.get("/products", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const { search, categoryId, lowStock } = req.query;

  const rows = await db
    .select({ product: productsTable, categoryName: categoriesTable.name, supplierName: suppliersTable.name })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .where(eq(productsTable.organizationId, orgId));

  const result = await Promise.all(
    rows
      .filter(({ product }) => {
        if (search && typeof search === "string") {
          const s = search.toLowerCase();
          if (!product.name.toLowerCase().includes(s) && !(product.sku || "").toLowerCase().includes(s)) return false;
        }
        if (categoryId) {
          if (product.categoryId !== parseInt(categoryId as string, 10)) return false;
        }
        return true;
      })
      .map(async ({ product, categoryName, supplierName }) => {
        const inv = await db.select({ qty: sum(inventoryTable.quantity) }).from(inventoryTable).where(eq(inventoryTable.productId, product.id));
        const stockQuantity = Number(inv[0]?.qty ?? 0);
        if (lowStock === "true" && (!product.reorderPoint || stockQuantity > product.reorderPoint)) return null;
        return { ...product, categoryName: categoryName ?? null, supplierName: supplierName ?? null, stockQuantity };
      })
  );

  res.json(result.filter(Boolean));
});

router.post("/products", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.organizationId!;
  const { name, price, description, sku, barcode, costPrice, categoryId, supplierId, unit, taxRate, image, trackInventory, reorderPoint } = req.body;
  if (!name || price == null) { res.status(400).json({ error: "Name and price required" }); return; }
  const [product] = await db.insert(productsTable).values({
    organizationId: orgId,
    name, price, description, sku, barcode,
    costPrice: costPrice || null,
    categoryId: categoryId || null,
    supplierId: supplierId || null,
    unit: unit || "piece",
    taxRate: taxRate || null,
    image: image || null,
    trackInventory: trackInventory !== false,
    reorderPoint: reorderPoint || null,
    status: "active",
  }).returning();
  res.status(201).json({ ...product, categoryName: null, supplierName: null, stockQuantity: 0 });
});

router.get("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [result] = await db
    .select({ product: productsTable, categoryName: categoriesTable.name, supplierName: suppliersTable.name })
    .from(productsTable)
    .leftJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .where(and(eq(productsTable.id, id), eq(productsTable.organizationId, req.organizationId!)));
  if (!result) { res.status(404).json({ error: "Not found" }); return; }
  const inv = await db.select({ qty: sum(inventoryTable.quantity) }).from(inventoryTable).where(eq(inventoryTable.productId, id));
  res.json({ ...result.product, categoryName: result.categoryName ?? null, supplierName: result.supplierName ?? null, stockQuantity: Number(inv[0]?.qty ?? 0) });
});

router.patch("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const updates: Record<string, unknown> = {};
  const fields = ["name","description","sku","barcode","price","costPrice","categoryId","supplierId","unit","taxRate","image","trackInventory","reorderPoint","status"];
  for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
  const [product] = await db.update(productsTable).set(updates).where(and(eq(productsTable.id, id), eq(productsTable.organizationId, req.organizationId!))).returning();
  if (!product) { res.status(404).json({ error: "Not found" }); return; }
  const [sup] = product.supplierId
    ? await db.select({ name: suppliersTable.name }).from(suppliersTable).where(eq(suppliersTable.id, product.supplierId))
    : [{ name: null }];
  const inv = await db.select({ qty: sum(inventoryTable.quantity) }).from(inventoryTable).where(eq(inventoryTable.productId, id));
  res.json({ ...product, categoryName: null, supplierName: sup?.name ?? null, stockQuantity: Number(inv[0]?.qty ?? 0) });
});

router.delete("/products/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(productsTable).where(and(eq(productsTable.id, id), eq(productsTable.organizationId, req.organizationId!)));
  res.json({ success: true });
});

export default router;

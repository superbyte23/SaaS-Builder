import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useListProducts, useListCategories, useListSuppliers, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type ProductForm = { name: string; price: string; costPrice: string; sku: string; barcode: string; categoryId: string; supplierId: string; unit: string; taxRate: string; reorderPoint: string; description: string; trackInventory: boolean; };

const EMPTY_FORM: ProductForm = { name: "", price: "", costPrice: "", sku: "", barcode: "", categoryId: "none", supplierId: "none", unit: "piece", taxRate: "0", reorderPoint: "", description: "", trackInventory: true };

export default function Products() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: products, isLoading } = useListProducts({ search: search || undefined });
  const { data: categories } = useListCategories();
  const { data: suppliers } = useListSuppliers();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const set = (k: keyof ProductForm, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, price: String(p.price), costPrice: String(p.costPrice || ""),
      sku: p.sku || "", barcode: p.barcode || "",
      categoryId: p.categoryId ? String(p.categoryId) : "none",
      supplierId: p.supplierId ? String(p.supplierId) : "none",
      unit: p.unit || "piece", taxRate: String(p.taxRate || 0),
      reorderPoint: p.reorderPoint ? String(p.reorderPoint) : "",
      description: p.description || "", trackInventory: p.trackInventory !== false,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.price) { toast({ variant: "destructive", title: "Name and price are required." }); return; }
    const data = {
      name: form.name, price: parseFloat(form.price),
      costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
      sku: form.sku || undefined, barcode: form.barcode || undefined,
      categoryId: form.categoryId !== "none" ? parseInt(form.categoryId) : undefined,
      supplierId: form.supplierId !== "none" ? parseInt(form.supplierId) : undefined,
      unit: form.unit, taxRate: parseFloat(form.taxRate) || 0,
      reorderPoint: form.reorderPoint ? parseInt(form.reorderPoint) : undefined,
      description: form.description || undefined,
      trackInventory: form.trackInventory,
    };
    if (editing) {
      updateProduct.mutate({ id: editing.id, data }, {
        onSuccess: () => { toast({ title: "Product updated" }); setDialogOpen(false); qc.invalidateQueries(); },
        onError: () => toast({ variant: "destructive", title: "Failed to update product" }),
      });
    } else {
      createProduct.mutate({ data }, {
        onSuccess: () => { toast({ title: "Product created" }); setDialogOpen(false); qc.invalidateQueries(); },
        onError: () => toast({ variant: "destructive", title: "Failed to create product" }),
      });
    }
  };

  const handleDelete = (id: number) => {
    deleteProduct.mutate({ id }, {
      onSuccess: () => { toast({ title: "Product deleted" }); setDeleteId(null); qc.invalidateQueries(); },
      onError: () => toast({ variant: "destructive", title: "Failed to delete product" }),
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><h1 className="text-3xl font-bold tracking-tight">Products</h1><p className="text-muted-foreground">Manage your product catalog and pricing.</p></div>
          <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="py-10 text-center text-muted-foreground">Loading…</div> : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead><TableHead>SKU</TableHead><TableHead>Category</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Price</TableHead><TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Stock</TableHead><TableHead>Status</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products?.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">{p.sku || "-"}</TableCell>
                        <TableCell>{p.categoryName || "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{p.supplierName || "—"}</TableCell>
                        <TableCell className="text-right font-mono">₱{p.price.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{p.costPrice ? `₱${p.costPrice.toFixed(2)}` : "-"}</TableCell>
                        <TableCell className="text-right font-mono">{p.stockQuantity || 0}</TableCell>
                        <TableCell><Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!products?.length && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No products found.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Product name" /></div>
              <div className="space-y-1.5"><Label>Price ($) *</Label><Input type="number" min={0} step={0.01} value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0.00" /></div>
              <div className="space-y-1.5"><Label>Cost Price ($)</Label><Input type="number" min={0} step={0.01} value={form.costPrice} onChange={(e) => set("costPrice", e.target.value)} placeholder="0.00" /></div>
              <div className="space-y-1.5"><Label>SKU</Label><Input value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="ABC-123" /></div>
              <div className="space-y-1.5"><Label>Barcode</Label><Input value={form.barcode} onChange={(e) => set("barcode", e.target.value)} placeholder="1234567890" /></div>
              <div className="space-y-1.5"><Label>Category</Label>
                <Select value={form.categoryId} onValueChange={(v) => set("categoryId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Category</SelectItem>
                    {categories?.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Supplier</Label>
                <Select value={form.supplierId} onValueChange={(v) => set("supplierId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Supplier</SelectItem>
                    {suppliers?.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Unit</Label>
                <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["piece","pack","kg","g","litre","ml","box","dozen","pair","set"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>VAT Rate (%)</Label><Input type="number" min={0} max={100} step={0.1} value={form.taxRate} onChange={(e) => set("taxRate", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Reorder Point</Label><Input type="number" min={0} value={form.reorderPoint} onChange={(e) => set("reorderPoint", e.target.value)} placeholder="10" /></div>
              <div className="col-span-2 space-y-1.5"><Label>Description</Label><Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional description" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createProduct.isPending || updateProduct.isPending}>
              {editing ? "Save Changes" : "Create Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Product?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteId && handleDelete(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

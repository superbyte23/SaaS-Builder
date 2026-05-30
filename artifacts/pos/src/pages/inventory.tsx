import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useListInventory, useAdjustInventory, useListProducts, useListBranches } from "@workspace/api-client-react";
import type { InventoryAdjustmentReason } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertTriangle, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const REASONS = ["purchase","return","adjustment","damage","transfer","opening_stock","audit"];

type AdjForm = { productId: string; branchId: string; quantity: string; reason: string; notes: string };
const EMPTY: AdjForm = { productId: "", branchId: "", quantity: "", reason: "adjustment", notes: "" };

export default function Inventory() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adjType, setAdjType] = useState<"add" | "remove">("add");
  const [form, setForm] = useState<AdjForm>(EMPTY);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: inventory, isLoading } = useListInventory({});
  const { data: products } = useListProducts({});
  const { data: branches } = useListBranches();
  const adjust = useAdjustInventory();

  const set = (k: keyof AdjForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openAdjust = (type: "add" | "remove") => { setAdjType(type); setForm(EMPTY); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.productId || !form.branchId || !form.quantity || !form.reason) {
      toast({ variant: "destructive", title: "All fields are required." }); return;
    }
    const qty = parseFloat(form.quantity);
    if (isNaN(qty) || qty <= 0) { toast({ variant: "destructive", title: "Enter a valid quantity." }); return; }
    const finalQty = adjType === "remove" ? -qty : qty;
    adjust.mutate(
      { data: { productId: parseInt(form.productId), branchId: parseInt(form.branchId), quantity: finalQty, reason: form.reason as InventoryAdjustmentReason, notes: form.notes || undefined } },
      { onSuccess: () => { toast({ title: `Stock ${adjType === "add" ? "added" : "removed"} successfully` }); setDialogOpen(false); qc.invalidateQueries(); }, onError: () => toast({ variant: "destructive", title: "Failed to adjust stock" }) }
    );
  };

  const lowStockItems = inventory?.filter(i => i.reorderPoint !== null && i.quantity <= (i.reorderPoint || 0)) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-3xl font-bold tracking-tight">Inventory</h1><p className="text-muted-foreground">Monitor and adjust stock levels across all branches.</p></div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openAdjust("remove")}><Minus className="mr-2 h-4 w-4" /> Remove Stock</Button>
            <Button onClick={() => openAdjust("add")}><Plus className="mr-2 h-4 w-4" /> Add Stock</Button>
          </div>
        </div>

        {lowStockItems.length > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 px-4 py-3 text-amber-800 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">{lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""} below reorder point</span>
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            {isLoading ? <div className="py-10 text-center text-muted-foreground">Loading…</div> : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Branch</TableHead>
                      <TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Reorder At</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory?.map((item) => {
                      const isLow = item.reorderPoint !== null && item.quantity <= (item.reorderPoint || 0);
                      return (
                        <TableRow key={item.id} className={isLow ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">{item.productSku || "-"}</TableCell>
                          <TableCell>{item.branchName}</TableCell>
                          <TableCell className="text-right">
                            <span className={`font-mono font-bold ${isLow ? "text-destructive" : ""}`}>{item.quantity}</span>
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">{item.reorderPoint ?? "-"}</TableCell>
                          <TableCell>
                            {isLow ? <Badge variant="destructive" className="text-xs">Low Stock</Badge> : <Badge variant="outline" className="text-xs">OK</Badge>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!inventory?.length && <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No inventory records.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{adjType === "add" ? "Add Stock" : "Remove Stock"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5"><Label>Product *</Label>
              <Select value={form.productId} onValueChange={(v) => set("productId", v)}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>{products?.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Branch *</Label>
              <Select value={form.branchId} onValueChange={(v) => set("branchId", v)}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>{branches?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Quantity *</Label><Input type="number" min={1} step={1} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder="10" /></div>
              <div className="space-y-1.5"><Label>Reason *</Label>
                <Select value={form.reason} onValueChange={(v) => set("reason", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REASONS.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional notes" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={adjust.isPending} variant={adjType === "remove" ? "destructive" : "default"}>
              {adjType === "add" ? "Add Stock" : "Remove Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

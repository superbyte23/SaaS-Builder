import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useListCategories, useCreateCategory, useUpdateCategory, useDeleteCategory } from "@workspace/api-client-react";
import type { Category } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type CatForm = { name: string; description: string; color: string; icon: string };
const EMPTY: CatForm = { name: "", description: "", color: "#6366f1", icon: "" };

const PRESET_COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#8b5cf6","#ef4444","#3b82f6","#14b8a6","#f97316","#84cc16"];

export default function Categories() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CatForm>(EMPTY);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: categories, isLoading } = useListCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const del = useDeleteCategory();

  const set = (k: keyof CatForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => { setEditing(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (c: Category) => { setEditing(c); setForm({ name: c.name, description: c.description || "", color: c.color || "#6366f1", icon: c.icon || "" }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.name) { toast({ variant: "destructive", title: "Name is required." }); return; }
    const data = { name: form.name, description: form.description || undefined, color: form.color || undefined, icon: form.icon || undefined };
    if (editing) {
      update.mutate({ id: editing.id, data }, { onSuccess: () => { toast({ title: "Category updated" }); setDialogOpen(false); qc.invalidateQueries(); }, onError: () => toast({ variant: "destructive", title: "Failed to update" }) });
    } else {
      create.mutate({ data }, { onSuccess: () => { toast({ title: "Category created" }); setDialogOpen(false); qc.invalidateQueries(); }, onError: () => toast({ variant: "destructive", title: "Failed to create" }) });
    }
  };

  const handleDelete = (id: number) => {
    del.mutate({ id }, { onSuccess: () => { toast({ title: "Category deleted" }); setDeleteId(null); qc.invalidateQueries(); }, onError: () => toast({ variant: "destructive", title: "Failed to delete" }) });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-3xl font-bold tracking-tight">Categories</h1><p className="text-muted-foreground">Organize your products into categories.</p></div>
          <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Add Category</Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? <div className="py-10 text-center text-muted-foreground">Loading…</div> : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead><TableHead>Description</TableHead>
                      <TableHead className="text-right">Products</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories?.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {c.color && <span className="w-3 h-3 rounded-full inline-block shrink-0" style={{ background: c.color }} />}
                            {c.icon && <span>{c.icon}</span>}
                            <span className="font-medium">{c.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{c.description || "-"}</TableCell>
                        <TableCell className="text-right font-mono">{c.productCount}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!categories?.length && <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No categories yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Electronics" /></div>
            <div className="space-y-1.5"><Label>Description</Label><Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional description" /></div>
            <div className="space-y-1.5"><Label>Emoji Icon</Label><Input value={form.icon} onChange={(e) => set("icon", e.target.value)} placeholder="📱" className="w-24" /></div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => set("color", c)} className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`} style={{ background: c }} />
                ))}
                <input type="color" value={form.color} onChange={(e) => set("color", e.target.value)} className="h-7 w-10 rounded border cursor-pointer" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>{editing ? "Save Changes" : "Create Category"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Category?</AlertDialogTitle><AlertDialogDescription>Products in this category will become uncategorized.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteId && handleDelete(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

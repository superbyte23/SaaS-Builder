import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useListBranches, useCreateBranch, useUpdateBranch, useDeleteBranch } from "@workspace/api-client-react";
import type { Branch } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type BranchForm = { name: string; address: string; phone: string; email: string; taxRate: string };
const EMPTY: BranchForm = { name: "", address: "", phone: "", email: "", taxRate: "8" };

export default function Branches() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchForm>(EMPTY);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: branches, isLoading } = useListBranches();
  const create = useCreateBranch();
  const update = useUpdateBranch();
  const del = useDeleteBranch();

  const set = (k: keyof BranchForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => { setEditing(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (b: Branch) => { setEditing(b); setForm({ name: b.name, address: b.address || "", phone: b.phone || "", email: b.email || "", taxRate: String(b.taxRate || 8) }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.name) { toast({ variant: "destructive", title: "Branch name is required." }); return; }
    const data = { name: form.name, address: form.address || undefined, phone: form.phone || undefined, email: form.email || undefined, taxRate: parseFloat(form.taxRate) || 0 };
    if (editing) {
      update.mutate({ id: editing.id, data }, { onSuccess: () => { toast({ title: "Branch updated" }); setDialogOpen(false); qc.invalidateQueries(); }, onError: () => toast({ variant: "destructive", title: "Failed" }) });
    } else {
      create.mutate({ data }, { onSuccess: () => { toast({ title: "Branch created" }); setDialogOpen(false); qc.invalidateQueries(); }, onError: () => toast({ variant: "destructive", title: "Failed" }) });
    }
  };

  const handleDelete = (id: number) => {
    del.mutate({ id }, { onSuccess: () => { toast({ title: "Branch deleted" }); setDeleteId(null); qc.invalidateQueries(); }, onError: () => toast({ variant: "destructive", title: "Failed" }) });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-3xl font-bold tracking-tight">Branches</h1><p className="text-muted-foreground">Manage your store locations.</p></div>
          <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Add Branch</Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? <div className="py-10 text-center text-muted-foreground">Loading…</div> : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead><TableHead>Address</TableHead><TableHead>Phone</TableHead>
                      <TableHead className="text-right">Tax Rate</TableHead><TableHead>Status</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches?.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {b.isMain && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />}
                            <span className="font-medium">{b.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{b.address || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{b.phone || "-"}</TableCell>
                        <TableCell className="text-right font-mono">{b.taxRate != null ? `${b.taxRate}%` : "-"}</TableCell>
                        <TableCell><Badge variant={b.status === "active" ? "default" : "secondary"}>{b.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(b)}><Pencil className="h-3.5 w-3.5" /></Button>
                          {!b.isMain && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!branches?.length && <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No branches yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Branch" : "Add Branch"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5"><Label>Branch Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Downtown Store" /></div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="456 Main St, City" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1-555-0200" /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="branch@co.com" /></div>
            </div>
            <div className="space-y-1.5"><Label>Tax Rate (%)</Label><Input type="number" min={0} max={100} step={0.1} value={form.taxRate} onChange={(e) => set("taxRate", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>{editing ? "Save Changes" : "Create Branch"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Branch?</AlertDialogTitle><AlertDialogDescription>This will permanently remove this branch and all associated data.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteId && handleDelete(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

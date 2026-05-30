import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useListCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from "@workspace/api-client-react";
import type { Customer } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, Plus, Pencil, Trash2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type CustomerForm = { name: string; email: string; phone: string; address: string; notes: string };
const EMPTY: CustomerForm = { name: "", email: "", phone: "", address: "", notes: "" };

export default function Customers() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(EMPTY);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: customers, isLoading } = useListCustomers({ search: search || undefined });
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const del = useDeleteCustomer();

  const set = (k: keyof CustomerForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => { setEditing(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (c: Customer) => { setEditing(c); setForm({ name: c.name, email: c.email || "", phone: c.phone || "", address: c.address || "", notes: c.notes || "" }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.name) { toast({ variant: "destructive", title: "Name is required." }); return; }
    const data = { name: form.name, email: form.email || undefined, phone: form.phone || undefined, address: form.address || undefined, notes: form.notes || undefined };
    if (editing) {
      update.mutate({ id: editing.id, data }, { onSuccess: () => { toast({ title: "Customer updated" }); setDialogOpen(false); qc.invalidateQueries(); }, onError: () => toast({ variant: "destructive", title: "Failed to update" }) });
    } else {
      create.mutate({ data }, { onSuccess: () => { toast({ title: "Customer added" }); setDialogOpen(false); qc.invalidateQueries(); }, onError: () => toast({ variant: "destructive", title: "Failed to create" }) });
    }
  };

  const handleDelete = (id: number) => {
    del.mutate({ id }, { onSuccess: () => { toast({ title: "Customer deleted" }); setDeleteId(null); qc.invalidateQueries(); }, onError: () => toast({ variant: "destructive", title: "Failed to delete" }) });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><h1 className="text-3xl font-bold tracking-tight">Customers</h1><p className="text-muted-foreground">Manage your customer database and loyalty program.</p></div>
          <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Add Customer</Button>
        </div>
        <Card>
          <CardHeader className="pb-3">
            <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="py-10 text-center text-muted-foreground">Loading…</div> : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead>
                      <TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Total Spent</TableHead>
                      <TableHead className="text-right"><Star className="h-3.5 w-3.5 inline" /></TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers?.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.email || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{c.phone || "-"}</TableCell>
                        <TableCell className="text-right font-mono">{c.orderCount || 0}</TableCell>
                        <TableCell className="text-right font-mono text-primary font-medium">${(c.totalSpent || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-amber-500">{c.loyaltyPoints || 0}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!customers?.length && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No customers found.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5"><Label>Full Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Jane Smith" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="jane@email.com" /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1-555-0100" /></div>
            </div>
            <div className="space-y-1.5"><Label>Address</Label><Input value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="123 Main St, City" /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional notes" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>{editing ? "Save Changes" : "Add Customer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Customer?</AlertDialogTitle><AlertDialogDescription>This will permanently remove the customer and their data.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteId && handleDelete(deleteId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

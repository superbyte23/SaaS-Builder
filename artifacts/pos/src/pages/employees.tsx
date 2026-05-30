import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useListUsers, useCreateUser, useUpdateUser, useDeleteUser, useListBranches } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type EmpForm = { name: string; email: string; password: string; role: string; branchId: string; phone: string };
const EMPTY: EmpForm = { name: "", email: "", password: "", role: "cashier", branchId: "none", phone: "" };
const ROLES = ["owner","manager","cashier","inventory_staff","accountant","auditor"];

export default function Employees() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<EmpForm>(EMPTY);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: users, isLoading } = useListUsers();
  const { data: branches } = useListBranches();
  const create = useCreateUser();
  const update = useUpdateUser();
  const del = useDeleteUser();

  const set = (k: keyof EmpForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => { setEditing(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, branchId: u.branchId ? String(u.branchId) : "none", phone: u.phone || "" });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name || !form.email) { toast({ variant: "destructive", title: "Name and email are required." }); return; }
    if (!editing && !form.password) { toast({ variant: "destructive", title: "Password is required for new employees." }); return; }
    const data: any = { name: form.name, email: form.email, role: form.role, branchId: form.branchId !== "none" ? parseInt(form.branchId) : undefined, phone: form.phone || undefined };
    if (!editing) data.password = form.password;
    if (editing) {
      update.mutate({ id: editing.id, data }, { onSuccess: () => { toast({ title: "Employee updated" }); setDialogOpen(false); qc.invalidateQueries(); }, onError: () => toast({ variant: "destructive", title: "Failed" }) });
    } else {
      create.mutate({ data }, { onSuccess: () => { toast({ title: "Employee added" }); setDialogOpen(false); qc.invalidateQueries(); }, onError: () => toast({ variant: "destructive", title: "Failed — email may be in use" }) });
    }
  };

  const handleDelete = (id: number) => {
    del.mutate({ id }, { onSuccess: () => { toast({ title: "Employee removed" }); setDeleteId(null); qc.invalidateQueries(); }, onError: () => toast({ variant: "destructive", title: "Failed" }) });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div><h1 className="text-3xl font-bold tracking-tight">Employees</h1><p className="text-muted-foreground">Manage staff access and roles.</p></div>
          <Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" /> Add Employee</Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? <div className="py-10 text-center text-muted-foreground">Loading…</div> : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead>
                      <TableHead>Branch</TableHead><TableHead>Status</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users?.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{u.role.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell>{u.branchName || "All Branches"}</TableCell>
                        <TableCell><Badge variant={u.status === "active" ? "default" : "secondary"}>{u.status}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(u.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!users?.length && <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No employees found.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5"><Label>Full Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Alex Johnson" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="alex@company.com" /></div>
              <div className="space-y-1.5"><Label>{editing ? "New Password" : "Password *"}</Label><Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={editing ? "Leave blank to keep" : "Min. 8 chars"} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => set("role", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Branch</Label>
                <Select value={form.branchId} onValueChange={(v) => set("branchId", v)}>
                  <SelectTrigger><SelectValue placeholder="All branches" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All Branches</SelectItem>
                    {branches?.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1-555-0100" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>{editing ? "Save Changes" : "Add Employee"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove Employee?</AlertDialogTitle><AlertDialogDescription>This will remove their account access.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteId && handleDelete(deleteId)}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

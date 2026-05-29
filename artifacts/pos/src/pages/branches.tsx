import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useListBranches } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Branches() {
  const { data: branches, isLoading } = useListBranches();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Branches</h1>
            <p className="text-muted-foreground">Manage your store locations.</p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Add Branch
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="py-10 text-center text-muted-foreground">Loading branches...</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches?.map((branch) => (
                      <TableRow key={branch.id}>
                        <TableCell className="font-medium">{branch.name}</TableCell>
                        <TableCell className="text-muted-foreground">{branch.address || "-"}</TableCell>
                        <TableCell className="text-muted-foreground">{branch.phone || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={branch.status === "active" ? "default" : "secondary"}>
                            {branch.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {branch.isMain && <Badge variant="outline">Main Branch</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!branches?.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          No branches found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useListInventory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function Inventory() {
  const { data: inventory, isLoading } = useListInventory();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
            <p className="text-muted-foreground">Monitor stock levels across branches.</p>
          </div>
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Adjust Stock
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="py-10 text-center text-muted-foreground">Loading inventory...</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Reorder Point</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">{item.productSku || "-"}</TableCell>
                        <TableCell>{item.branchName}</TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          <span className={item.quantity <= (item.reorderPoint || 0) ? "text-destructive" : ""}>
                            {item.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{item.reorderPoint || "-"}</TableCell>
                      </TableRow>
                    ))}
                    {!inventory?.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                          No inventory records found.
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

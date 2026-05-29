import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useListOrders } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function Orders() {
  const { data: orders, isLoading } = useListOrders();

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'completed': return 'default';
      case 'refunded': return 'destructive';
      case 'voided': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">View and manage transaction history.</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="py-10 text-center text-muted-foreground">Loading orders...</div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Cashier</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders?.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono font-medium">{order.orderNumber}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(order.createdAt), "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>{order.customerName || "Walk-in"}</TableCell>
                        <TableCell>{order.cashierName || "-"}</TableCell>
                        <TableCell className="text-right font-mono font-bold">${order.total.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(order.status) as any} className="capitalize">
                            {order.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!orders?.length && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          No orders found.
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

import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  useListProducts, useListCategories, useListCustomers,
  useCreateOrder, useCompleteOrder,
} from "@workspace/api-client-react";
import type { Product, PaymentInputPaymentMethod } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, User, Tag, X, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

type CartItem = { product: Product; quantity: number; discount: number };

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "mobile_wallet", label: "Mobile Wallet", icon: Smartphone },
  { value: "bank_transfer", label: "Bank Transfer", icon: CreditCard },
];

export default function POS() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | undefined>(undefined);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentInputPaymentMethod>("cash");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [completedOrder, setCompletedOrder] = useState<any>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const { toast } = useToast();

  const { data: categories } = useListCategories();
  const { data: products, isLoading: isLoadingProducts } = useListProducts({
    search: search || undefined,
    categoryId,
  });
  const { data: customers } = useListCustomers({});
  const createOrder = useCreateOrder();
  const completeOrder = useCompleteOrder();

  const TAX_RATE = 0.08;

  const addToCart = (product: Product) => {
    setCart((cur) => {
      const existing = cur.find((i) => i.product.id === product.id);
      if (existing) return cur.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...cur, { product, quantity: 1, discount: 0 }];
    });
  };

  const updateQty = (id: number, delta: number) =>
    setCart((cur) => cur.map((i) => i.product.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i).filter(i => i.quantity > 0));

  const removeItem = (id: number) => setCart((cur) => cur.filter((i) => i.product.id !== id));

  const updateItemDiscount = (id: number, val: number) =>
    setCart((cur) => cur.map((i) => i.product.id === id ? { ...i, discount: Math.max(0, val) } : i));

  const clearCart = () => { setCart([]); setOrderDiscount(0); setSelectedCustomerId(undefined); };

  const itemsSubtotal = useMemo(() =>
    cart.reduce((s, i) => s + (i.product.price * i.quantity - i.discount), 0), [cart]);
  const discountedSubtotal = Math.max(0, itemsSubtotal - orderDiscount);
  const taxAmount = discountedSubtotal * TAX_RATE;
  const total = discountedSubtotal + taxAmount;
  const receivedNum = parseFloat(receivedAmount) || 0;
  const change = Math.max(0, receivedNum - total);

  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setReceivedAmount(total.toFixed(2));
    setCheckoutOpen(true);
  };

  const handleCharge = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === "cash" && receivedNum < total) {
      toast({ variant: "destructive", title: "Insufficient Amount", description: "Received amount is less than total." });
      return;
    }
    try {
      const items = cart.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
        unitPrice: i.product.price,
        discount: i.discount,
      }));
      const order = await new Promise<any>((resolve, reject) => {
        createOrder.mutate(
          { data: { branchId: user?.branchId || 1, customerId: selectedCustomerId, items, discountAmount: orderDiscount } },
          { onSuccess: resolve, onError: reject }
        );
      });
      const completed = await new Promise<any>((resolve, reject) => {
        completeOrder.mutate(
          { id: order.id, data: { paymentMethod, amountPaid: receivedNum || total } },
          { onSuccess: resolve, onError: reject }
        );
      });
      setCompletedOrder(completed);
      setCheckoutOpen(false);
      setReceiptOpen(true);
      clearCart();
    } catch {
      toast({ variant: "destructive", title: "Transaction Failed", description: "Could not process the payment." });
    }
  };

  const selectedCustomer = customers?.find((c) => c.id === selectedCustomerId);

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)] gap-4 -m-4 p-4">
        {/* Products panel */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search products or scan barcode…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
          {categories && (
            <Tabs value={categoryId?.toString() || "all"} onValueChange={(v) => setCategoryId(v === "all" ? undefined : Number(v))}>
              <TabsList className="w-full justify-start overflow-x-auto bg-transparent p-0 gap-1.5 h-auto flex-wrap">
                <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-3 py-1.5 text-sm bg-card border shadow-sm">All</TabsTrigger>
                {categories.map((c) => (
                  <TabsTrigger key={c.id} value={c.id.toString()} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-3 py-1.5 text-sm bg-card border shadow-sm">
                    {c.icon && <span className="mr-1">{c.icon}</span>}{c.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 pb-4">
              {isLoadingProducts ? (
                <div className="col-span-full py-10 text-center text-muted-foreground">Loading products…</div>
              ) : products?.length === 0 ? (
                <div className="col-span-full py-10 text-center text-muted-foreground">No products found.</div>
              ) : (
                products?.map((product) => (
                  <Card key={product.id} className="cursor-pointer hover:border-primary hover:shadow-md transition-all overflow-hidden flex flex-col" onClick={() => addToCart(product)}>
                    <div className="h-28 bg-muted/30 flex items-center justify-center">
                      {product.image ? <img src={product.image} alt={product.name} className="h-full object-contain" /> : <div className="text-3xl opacity-20 font-bold">IMG</div>}
                    </div>
                    <CardContent className="p-3 flex-1 flex flex-col justify-between gap-1">
                      <div>
                        <div className="text-xs text-muted-foreground">{product.categoryName || "Uncategorized"}</div>
                        <h3 className="font-semibold text-sm leading-tight line-clamp-2">{product.name}</h3>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="font-mono text-primary font-bold text-sm">${product.price.toFixed(2)}</span>
                        {product.stockQuantity != null && (
                          <span className={`text-xs font-mono ${product.stockQuantity <= (product.reorderPoint || 0) ? "text-destructive" : "text-muted-foreground"}`}>
                            {product.stockQuantity} left
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Cart panel */}
        <Card className="w-[360px] flex flex-col shadow-lg">
          <CardHeader className="border-b px-4 py-3 flex flex-row items-center justify-between shrink-0">
            <CardTitle className="text-base">Current Order</CardTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearCart} disabled={cart.length === 0}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardHeader>

          {/* Customer selector */}
          <div className="px-4 pt-3 pb-2 border-b">
            <Select value={selectedCustomerId?.toString() || "none"} onValueChange={(v) => setSelectedCustomerId(v === "none" ? undefined : Number(v))}>
              <SelectTrigger className="h-8 text-sm">
                <User className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Select customer (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Walk-in Customer</SelectItem>
                {customers?.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="flex-1 px-4 py-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-16 gap-2">
                <div className="text-5xl opacity-20">🛒</div>
                <p className="text-sm">Tap products to add them</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.product.id} className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm leading-tight truncate">{item.product.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">${item.product.price.toFixed(2)}/ea</div>
                      </div>
                      <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQty(item.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                        <span className="text-sm font-mono w-5 text-center">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQty(item.product.id, 1)}><Plus className="h-3 w-3" /></Button>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-sm font-semibold w-14 text-right">
                          ${(item.product.price * item.quantity - item.discount).toFixed(2)}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.product.id)}><X className="h-3 w-3" /></Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-1">
                      <Tag className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Item disc:</span>
                      <Input
                        type="number" min={0} step={0.01}
                        value={item.discount || ""}
                        onChange={(e) => updateItemDiscount(item.product.id, parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="h-6 text-xs w-20 font-mono px-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Totals */}
          <div className="border-t px-4 pt-3 pb-2 space-y-1.5 shrink-0">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-mono">${itemsSubtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> Order discount</span>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number" min={0} step={0.01}
                  value={orderDiscount || ""}
                  onChange={(e) => setOrderDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="h-6 text-xs w-20 font-mono px-2 text-right"
                />
              </div>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>VAT ({(TAX_RATE * 100).toFixed(0)}%)</span>
              <span className="font-mono">${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span className="font-mono text-primary">${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="px-4 pb-4 shrink-0">
            <Button className="w-full h-12 text-base font-bold" onClick={handleOpenCheckout} disabled={cart.length === 0}>
              Charge ${total.toFixed(2)}
            </Button>
          </div>
        </Card>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Order summary */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono">${itemsSubtotal.toFixed(2)}</span></div>
              {orderDiscount > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span className="font-mono text-emerald-600">-${orderDiscount.toFixed(2)}</span></div>}
              <div className="flex justify-between text-muted-foreground"><span>VAT ({(TAX_RATE * 100).toFixed(0)}%)</span><span className="font-mono">${taxAmount.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total</span><span className="font-mono text-primary">${total.toFixed(2)}</span></div>
            </div>

            {/* Customer */}
            {selectedCustomer && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium">{selectedCustomer.name}</span>
              </div>
            )}

            {/* Payment method */}
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((pm) => (
                  <Button
                    key={pm.value}
                    variant={paymentMethod === pm.value ? "default" : "outline"}
                    className="h-10 gap-2"
                    onClick={() => setPaymentMethod(pm.value as PaymentInputPaymentMethod)}
                  >
                    <pm.icon className="h-4 w-4" />
                    {pm.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Received amount (cash only) */}
            {paymentMethod === "cash" && (
              <div className="space-y-2">
                <Label>Amount Received ($)</Label>
                <Input
                  type="number" min={0} step={0.01}
                  value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  className="font-mono text-lg h-12 text-right"
                  autoFocus
                />
                <div className="flex justify-between items-center rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
                  <span className="text-sm font-medium">Change</span>
                  <span className={`font-mono font-bold text-lg ${change < 0 ? "text-destructive" : "text-emerald-600"}`}>
                    ${change.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Cancel</Button>
            <Button
              className="flex-1"
              onClick={handleCharge}
              disabled={createOrder.isPending || completeOrder.isPending || (paymentMethod === "cash" && receivedNum < total)}
            >
              {createOrder.isPending || completeOrder.isPending ? "Processing…" : `Confirm $${total.toFixed(2)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Payment Successful
            </DialogTitle>
          </DialogHeader>
          {completedOrder && (
            <div className="space-y-3 text-sm font-mono">
              <div className="text-center text-muted-foreground text-xs">{completedOrder.orderNumber}</div>
              <div className="border-t border-dashed pt-3 space-y-1">
                {completedOrder.items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between">
                    <span className="truncate mr-2">{item.productName || `Item #${item.productId}`} x{item.quantity}</span>
                    <span>${item.totalPrice?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed pt-3 space-y-1">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>${completedOrder.subtotal?.toFixed(2)}</span></div>
                {completedOrder.discountAmount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-${completedOrder.discountAmount?.toFixed(2)}</span></div>}
                <div className="flex justify-between text-muted-foreground"><span>VAT</span><span>${completedOrder.taxAmount?.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-base border-t border-dashed pt-1"><span>TOTAL</span><span>${completedOrder.total?.toFixed(2)}</span></div>
                {completedOrder.paymentMethod === "cash" && (
                  <>
                    <div className="flex justify-between"><span>Received</span><span>${completedOrder.amountPaid?.toFixed(2)}</span></div>
                    <div className="flex justify-between text-emerald-600"><span>Change</span><span>${completedOrder.change?.toFixed(2)}</span></div>
                  </>
                )}
              </div>
              <div className="text-center text-muted-foreground border-t border-dashed pt-2 text-xs">Thank you for your purchase!</div>
            </div>
          )}
          <DialogFooter>
            <Button className="w-full" onClick={() => setReceiptOpen(false)}>New Sale</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

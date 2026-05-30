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
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, User, Tag, X, CheckCircle2, ShieldCheck, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";

const VAT_RATE = 0.12; // Philippines 12% VAT

type CartItem = { product: Product; quantity: number };

// Philippine discount types (RA 9994, RA 10754, RA 8972)
type DiscountType = "none" | "sc" | "pwd" | "solo_parent" | "custom_pct" | "custom_fixed";

type DiscountConfig = {
  label: string;
  shortLabel: string;
  rate: number | null;   // null = user-defined
  vatExempt: boolean;    // SC & PWD are VAT-exempt per law
  requiresId: boolean;
  idLabel: string;
  color: string;
  badge: string;
};

const DISCOUNT_TYPES: Record<DiscountType, DiscountConfig> = {
  none:        { label: "No Discount",             shortLabel: "None",       rate: null, vatExempt: false, requiresId: false, idLabel: "",                  color: "", badge: "" },
  sc:          { label: "Senior Citizen — 20% (RA 9994)",  shortLabel: "SC",  rate: 0.20, vatExempt: true,  requiresId: true,  idLabel: "Senior Citizen ID No.", color: "text-blue-600", badge: "bg-blue-100 text-blue-800 border-blue-200" },
  pwd:         { label: "PWD — 20% (RA 10754)",    shortLabel: "PWD",        rate: 0.20, vatExempt: true,  requiresId: true,  idLabel: "PWD ID Number",     color: "text-purple-600", badge: "bg-purple-100 text-purple-800 border-purple-200" },
  solo_parent: { label: "Solo Parent — 10% (RA 8972)", shortLabel: "Solo Parent", rate: 0.10, vatExempt: false, requiresId: true, idLabel: "Solo Parent ID No.", color: "text-emerald-600", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  custom_pct:  { label: "Custom Discount (%)",     shortLabel: "Custom %",   rate: null, vatExempt: false, requiresId: false, idLabel: "",                  color: "text-amber-600", badge: "bg-amber-100 text-amber-800 border-amber-200" },
  custom_fixed:{ label: "Custom Discount (Fixed ₱)", shortLabel: "Custom ₱", rate: null, vatExempt: false, requiresId: false, idLabel: "",                  color: "text-amber-600", badge: "bg-amber-100 text-amber-800 border-amber-200" },
};

const PAYMENT_METHODS = [
  { value: "cash",          label: "Cash",          icon: Banknote },
  { value: "card",          label: "Card",          icon: CreditCard },
  { value: "mobile_wallet", label: "GCash / Maya",  icon: Smartphone },
  { value: "bank_transfer", label: "Bank Transfer", icon: CreditCard },
];

/**
 * Compute discount & totals according to Philippine tax rules.
 *
 * Prices are assumed VAT-inclusive (12% already included).
 *
 * SC / PWD (VAT-exempt):
 *   vatExclusiveTotal = subtotal / 1.12
 *   discountAmount    = vatExclusiveTotal × 20%
 *   vatAmount         = 0  (store absorbs VAT)
 *   grandTotal        = vatExclusiveTotal × 80%
 *
 * Solo Parent / Custom (NOT VAT-exempt):
 *   discountAmount    = subtotal × rate  (or fixed)
 *   discountedSubtotal = subtotal − discount
 *   vatAmount         = discountedSubtotal × (VAT_RATE / (1 + VAT_RATE))   ← VAT already inside price
 *   grandTotal        = discountedSubtotal
 */
function computeTotals(subtotal: number, type: DiscountType, customValue: number) {
  const cfg = DISCOUNT_TYPES[type];

  if (type === "none") {
    const vatAmount = subtotal * (VAT_RATE / (1 + VAT_RATE));
    return { discountAmount: 0, vatAmount, grandTotal: subtotal, vatExempt: false };
  }

  if (type === "sc" || type === "pwd") {
    const vatExclusive = subtotal / (1 + VAT_RATE);
    const discountAmount = vatExclusive * 0.20;
    const grandTotal = vatExclusive * 0.80;
    return { discountAmount, vatAmount: 0, grandTotal, vatExempt: true };
  }

  if (type === "solo_parent") {
    const discountAmount = subtotal * 0.10;
    const discountedSubtotal = subtotal - discountAmount;
    const vatAmount = discountedSubtotal * (VAT_RATE / (1 + VAT_RATE));
    return { discountAmount, vatAmount, grandTotal: discountedSubtotal, vatExempt: false };
  }

  if (type === "custom_pct") {
    const rate = Math.min(customValue, 100) / 100;
    const discountAmount = subtotal * rate;
    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const vatAmount = discountedSubtotal * (VAT_RATE / (1 + VAT_RATE));
    return { discountAmount, vatAmount, grandTotal: discountedSubtotal, vatExempt: false };
  }

  // custom_fixed
  const discountAmount = Math.min(customValue, subtotal);
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const vatAmount = discountedSubtotal * (VAT_RATE / (1 + VAT_RATE));
  return { discountAmount, vatAmount, grandTotal: discountedSubtotal, vatExempt: false };
}

export default function POS() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Discount state
  const [discountType, setDiscountType] = useState<DiscountType>("none");
  const [customDiscountValue, setCustomDiscountValue] = useState(0);
  const [discountIdNumber, setDiscountIdNumber] = useState("");

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

  // ─── Cart helpers ────────────────────────────────────────────────────────────
  const addToCart = (product: Product) =>
    setCart((cur) => {
      const ex = cur.find((i) => i.product.id === product.id);
      if (ex) return cur.map((i) => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...cur, { product, quantity: 1 }];
    });

  const updateQty = (id: number, delta: number) =>
    setCart((cur) => cur.map((i) => i.product.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i).filter((i) => i.quantity > 0));

  const removeItem = (id: number) => setCart((cur) => cur.filter((i) => i.product.id !== id));

  const clearCart = () => {
    setCart([]);
    setDiscountType("none");
    setCustomDiscountValue(0);
    setDiscountIdNumber("");
    setSelectedCustomerId(undefined);
  };

  // ─── Totals ──────────────────────────────────────────────────────────────────
  const subtotal = useMemo(
    () => cart.reduce((s, i) => s + i.product.price * i.quantity, 0),
    [cart]
  );

  const { discountAmount, vatAmount, grandTotal, vatExempt } = useMemo(
    () => computeTotals(subtotal, discountType, customDiscountValue),
    [subtotal, discountType, customDiscountValue]
  );

  const receivedNum = parseFloat(receivedAmount) || 0;
  const change = Math.max(0, receivedNum - grandTotal);
  const cfg = DISCOUNT_TYPES[discountType];

  // ─── Checkout ────────────────────────────────────────────────────────────────
  const handleOpenCheckout = () => {
    if (cart.length === 0) return;
    setReceivedAmount(grandTotal.toFixed(2));
    setCheckoutOpen(true);
  };

  const handleCharge = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === "cash" && receivedNum < grandTotal) {
      toast({ variant: "destructive", title: "Insufficient Amount", description: "Received amount is less than total." });
      return;
    }
    try {
      const items = cart.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
        unitPrice: i.product.price,
      }));
      const order = await new Promise<any>((resolve, reject) =>
        createOrder.mutate(
          { data: { branchId: user?.branchId || 1, customerId: selectedCustomerId, items, discountAmount, notes: discountIdNumber ? `${cfg.shortLabel} ID: ${discountIdNumber}` : undefined } },
          { onSuccess: resolve, onError: reject }
        )
      );
      const completed = await new Promise<any>((resolve, reject) =>
        completeOrder.mutate(
          { id: order.id, data: { paymentMethod, amountPaid: receivedNum || grandTotal } },
          { onSuccess: resolve, onError: reject }
        )
      );
      setCompletedOrder({ ...completed, computedChange: change, paymentMethod });
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

        {/* ── Products panel ── */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search products or scan barcode…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                        <span className="font-mono text-primary font-bold text-sm">₱{product.price.toFixed(2)}</span>
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

        {/* ── Cart panel ── */}
        <Card className="w-[370px] flex flex-col shadow-lg">
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
                <User className="h-3.5 w-3.5 mr-2 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Walk-in Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Walk-in Customer</SelectItem>
                {customers?.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Cart items */}
          <ScrollArea className="flex-1 px-4 py-3">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-16 gap-2">
                <div className="text-5xl opacity-20">🛒</div>
                <p className="text-sm">Tap products to add them</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm leading-tight truncate">{item.product.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">₱{item.product.price.toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQty(item.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="text-sm font-mono w-5 text-center">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQty(item.product.id, 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                    <span className="font-mono text-sm font-semibold w-16 text-right">₱{(item.product.price * item.quantity).toFixed(2)}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeItem(item.product.id)}><X className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* ── Discount selector ── */}
          <div className="border-t px-4 pt-3 pb-2 space-y-2 shrink-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
              <Label className="text-sm text-muted-foreground">Discount Type</Label>
            </div>
            <Select value={discountType} onValueChange={(v) => { setDiscountType(v as DiscountType); setCustomDiscountValue(0); setDiscountIdNumber(""); }}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(DISCOUNT_TYPES) as [DiscountType, DiscountConfig][]).map(([key, dc]) => (
                  <SelectItem key={key} value={key}>{dc.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Custom value input */}
            {(discountType === "custom_pct" || discountType === "custom_fixed") && (
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground shrink-0">
                  {discountType === "custom_pct" ? "Discount %" : "Discount ₱"}
                </Label>
                <Input
                  type="number" min={0} step={discountType === "custom_pct" ? 1 : 0.01}
                  max={discountType === "custom_pct" ? 100 : subtotal}
                  value={customDiscountValue || ""}
                  onChange={(e) => setCustomDiscountValue(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="h-8 text-sm font-mono text-right"
                />
              </div>
            )}

            {/* ID number for government discounts */}
            {cfg.requiresId && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{cfg.idLabel}</Label>
                <Input value={discountIdNumber} onChange={(e) => setDiscountIdNumber(e.target.value)} placeholder="Enter ID number" className="h-8 text-sm font-mono" />
              </div>
            )}

            {/* VAT-exempt notice */}
            {vatExempt && (
              <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 px-3 py-1.5">
                <Info className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span className="text-xs text-blue-700 dark:text-blue-400">VAT-exempt — discount applied on VAT-exclusive price</span>
              </div>
            )}
          </div>

          {/* ── Totals ── */}
          <div className="border-t px-4 pt-3 pb-2 space-y-1.5 text-sm shrink-0">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-mono">₱{subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between font-medium">
                <span className={cfg.color}>
                  {discountType === "sc" ? "SC 20% Discount" :
                   discountType === "pwd" ? "PWD 20% Discount" :
                   discountType === "solo_parent" ? "Solo Parent 10% Discount" :
                   discountType === "custom_pct" ? `Discount (${customDiscountValue}%)` :
                   `Discount`}
                </span>
                <span className={`font-mono ${cfg.color}`}>−₱{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>VAT (12%){vatExempt ? " — Exempt" : ""}</span>
              <span className="font-mono">{vatExempt ? "₱0.00" : `₱${vatAmount.toFixed(2)}`}</span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span className="font-mono text-primary">₱{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="px-4 pb-4 shrink-0">
            <Button className="w-full h-12 text-base font-bold" onClick={handleOpenCheckout} disabled={cart.length === 0}>
              Charge ₱{grandTotal.toFixed(2)}
            </Button>
          </div>
        </Card>
      </div>

      {/* ── Checkout Dialog ── */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {/* Order summary */}
            <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono">₱{subtotal.toFixed(2)}</span></div>
              {discountAmount > 0 && (
                <>
                  <div className={`flex justify-between font-medium ${cfg.color}`}>
                    <span className="flex items-center gap-1.5">
                      {(discountType === "sc" || discountType === "pwd" || discountType === "solo_parent") &&
                        <span className={`text-xs px-1.5 py-0.5 rounded border font-bold ${cfg.badge}`}>{cfg.shortLabel}</span>
                      }
                      Discount
                    </span>
                    <span className="font-mono">−₱{discountAmount.toFixed(2)}</span>
                  </div>
                  {vatExempt && (
                    <div className="flex justify-between text-muted-foreground text-xs">
                      <span className="italic">VAT-exclusive base</span>
                      <span className="font-mono">₱{(subtotal / 1.12).toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>VAT (12%){vatExempt ? " — Exempt" : ""}</span>
                <span className="font-mono">{vatExempt ? "₱0.00" : `₱${vatAmount.toFixed(2)}`}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base"><span>TOTAL</span><span className="font-mono text-primary">₱{grandTotal.toFixed(2)}</span></div>
            </div>

            {/* Discount ID display */}
            {cfg.requiresId && discountIdNumber && (
              <div className="flex items-center gap-2 text-sm rounded-md border px-3 py-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{cfg.idLabel}:</span>
                <span className="font-mono font-medium">{discountIdNumber}</span>
              </div>
            )}

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
              <Label className="text-sm">Payment Method</Label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((pm) => (
                  <Button key={pm.value} variant={paymentMethod === pm.value ? "default" : "outline"} className="h-10 gap-2 text-sm"
                    onClick={() => setPaymentMethod(pm.value as PaymentInputPaymentMethod)}>
                    <pm.icon className="h-4 w-4" />{pm.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Received amount — cash only */}
            {paymentMethod === "cash" && (
              <div className="space-y-2">
                <Label className="text-sm">Amount Received (₱)</Label>
                <Input type="number" min={0} step={0.01} value={receivedAmount}
                  onChange={(e) => setReceivedAmount(e.target.value)}
                  className="font-mono text-lg h-12 text-right" autoFocus />
                <div className="flex justify-between items-center rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-3 py-2">
                  <span className="text-sm font-medium">Change</span>
                  <span className={`font-mono font-bold text-lg ${receivedNum < grandTotal ? "text-destructive" : "text-emerald-600"}`}>
                    ₱{change.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleCharge}
              disabled={createOrder.isPending || completeOrder.isPending || (paymentMethod === "cash" && receivedNum < grandTotal)}>
              {createOrder.isPending || completeOrder.isPending ? "Processing…" : `Confirm ₱${grandTotal.toFixed(2)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Receipt Dialog ── */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Payment Successful
            </DialogTitle>
          </DialogHeader>
          {completedOrder && (
            <div className="text-sm font-mono space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="text-center text-muted-foreground text-xs">{completedOrder.orderNumber}</div>

              {/* Items */}
              <div className="border-t border-dashed pt-2 space-y-1">
                {completedOrder.items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between gap-2">
                    <span className="truncate">{item.productName || `Item #${item.productId}`} ×{item.quantity}</span>
                    <span className="shrink-0">₱{(item.unitPrice * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-dashed pt-2 space-y-1">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>₱{subtotal.toFixed(2)}</span></div>
                {completedOrder.discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1">
                      Discount
                      {completedOrder.discountType && completedOrder.discountType !== "none" && (
                        <span className={`text-xs px-1 border rounded ${DISCOUNT_TYPES[completedOrder.discountType as DiscountType]?.badge || ""}`}>
                          {DISCOUNT_TYPES[completedOrder.discountType as DiscountType]?.shortLabel || ""}
                        </span>
                      )}
                    </span>
                    <span>−₱{completedOrder.discountAmount?.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>VAT (12%){vatExempt ? " EXEMPT" : ""}</span>
                  <span>₱{vatExempt ? "0.00" : vatAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-dashed pt-1 text-base">
                  <span>TOTAL</span><span>₱{completedOrder.total?.toFixed(2)}</span>
                </div>
                {completedOrder.paymentMethod === "cash" && (
                  <>
                    <div className="flex justify-between"><span>Cash</span><span>₱{completedOrder.amountPaid?.toFixed(2)}</span></div>
                    <div className="flex justify-between text-emerald-600"><span>Change</span><span>₱{completedOrder.computedChange?.toFixed(2)}</span></div>
                  </>
                )}
              </div>

              {/* Discount ID on receipt */}
              {completedOrder.discountIdNumber && (
                <div className="border-t border-dashed pt-2 text-xs text-muted-foreground">
                  {DISCOUNT_TYPES[completedOrder.discountType as DiscountType]?.idLabel}: {completedOrder.discountIdNumber}
                </div>
              )}

              <div className="text-center text-muted-foreground border-t border-dashed pt-2 text-xs">
                Thank you for your purchase!
              </div>
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

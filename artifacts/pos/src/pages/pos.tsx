import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useListProducts, useListCategories, useCreateOrder } from "@workspace/api-client-react";
import type { Product, OrderItemInput } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, Minus, Trash2, CreditCard, Banknote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CartItem = {
  product: Product;
  quantity: number;
};

export default function POS() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [cart, setCart] = useState<CartItem[]>([]);
  const { toast } = useToast();

  const { data: categories } = useListCategories();
  const { data: products, isLoading: isLoadingProducts } = useListProducts({ 
    search: search || undefined, 
    categoryId 
  });

  const createOrder = useCreateOrder();

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((current) =>
      current
        .map((item) => {
          if (item.product.id === productId) {
            return { ...item, quantity: Math.max(0, item.quantity + delta) };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const clearCart = () => setCart([]);

  const subtotal = useMemo(() => {
    return cart.reduce((total, item) => total + item.product.price * item.quantity, 0);
  }, [cart]);

  const tax = subtotal * 0.1; // Default 10% tax for stub
  const total = subtotal + tax;

  const handleCharge = () => {
    if (cart.length === 0) return;

    const items: OrderItemInput[] = cart.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
      unitPrice: item.product.price,
    }));

    createOrder.mutate(
      { data: { branchId: 1, items } }, // Mock branchId 1 for now
      {
        onSuccess: () => {
          toast({ title: "Order Completed", description: `Successfully charged $${total.toFixed(2)}` });
          clearCart();
        },
        onError: () => {
          toast({ variant: "destructive", title: "Error", description: "Failed to process order" });
        }
      }
    );
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-4rem)] gap-6 -m-4 p-4">
        {/* Left Side: Products */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-card border-none shadow-sm"
              />
            </div>
          </div>
          
          {categories && (
            <Tabs value={categoryId?.toString() || "all"} onValueChange={(v) => setCategoryId(v === "all" ? undefined : Number(v))}>
              <TabsList className="w-full justify-start overflow-x-auto bg-transparent p-0 gap-2 h-auto">
                <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 py-2 bg-card border shadow-sm">All</TabsTrigger>
                {categories.map((c) => (
                  <TabsTrigger key={c.id} value={c.id.toString()} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4 py-2 bg-card border shadow-sm">
                    {c.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4">
              {isLoadingProducts ? (
                <div className="col-span-full py-10 text-center text-muted-foreground">Loading products...</div>
              ) : products?.length === 0 ? (
                <div className="col-span-full py-10 text-center text-muted-foreground">No products found.</div>
              ) : (
                products?.map((product) => (
                  <Card key={product.id} className="cursor-pointer hover:border-primary transition-colors overflow-hidden flex flex-col h-full shadow-sm" onClick={() => addToCart(product)}>
                    <div className="h-32 bg-muted/50 flex items-center justify-center p-4">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="h-full object-contain mix-blend-multiply" />
                      ) : (
                        <div className="text-4xl opacity-20 font-bold tracking-tighter">IMG</div>
                      )}
                    </div>
                    <CardContent className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">{product.categoryName || 'Uncategorized'}</div>
                        <h3 className="font-semibold text-sm leading-tight line-clamp-2">{product.name}</h3>
                      </div>
                      <div className="mt-2 font-mono text-primary font-bold">
                        ${product.price.toFixed(2)}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Side: Cart */}
        <Card className="w-96 flex flex-col shadow-lg border-none bg-card/50 backdrop-blur">
          <CardHeader className="border-b px-4 py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Current Order</CardTitle>
            <Button variant="ghost" size="icon" onClick={clearCart} disabled={cart.length === 0}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </CardHeader>
          
          <ScrollArea className="flex-1 p-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4 py-20">
                <ShoppingCartIcon className="h-12 w-12 opacity-20" />
                <p>Cart is empty</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{item.product.name}</div>
                      <div className="text-xs text-muted-foreground">${item.product.price.toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-2 bg-muted rounded-md p-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.product.id, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-mono w-4 text-center">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.product.id, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="font-mono text-sm w-16 text-right font-semibold">
                      ${(item.product.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          <div className="border-t bg-card p-4 space-y-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax (10%)</span>
                <span className="font-mono">${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2">
                <span>Total</span>
                <span className="font-mono text-primary">${total.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-14 font-semibold">
                <Banknote className="mr-2 h-5 w-5" /> Cash
              </Button>
              <Button variant="outline" className="h-14 font-semibold">
                <CreditCard className="mr-2 h-5 w-5" /> Card
              </Button>
            </div>
            
            <Button 
              className="w-full h-14 text-lg font-bold" 
              size="lg" 
              onClick={handleCharge}
              disabled={cart.length === 0 || createOrder.isPending}
            >
              {createOrder.isPending ? "Processing..." : `Charge $${total.toFixed(2)}`}
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function ShoppingCartIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}
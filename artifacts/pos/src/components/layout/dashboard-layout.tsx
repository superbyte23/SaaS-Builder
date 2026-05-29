import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Store,
  Settings,
  LogOut,
  Boxes,
  Truck,
  FileText,
  WalletCards,
  Tags,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard", section: "Main" },
  { icon: ShoppingCart, label: "POS", href: "/pos", section: "Sales" },
  { icon: WalletCards, label: "Orders", href: "/orders", section: "Sales" },
  { icon: Package, label: "Products", href: "/products", section: "Inventory" },
  { icon: Tags, label: "Categories", href: "/categories", section: "Inventory" },
  { icon: Boxes, label: "Inventory", href: "/inventory", section: "Inventory" },
  { icon: Users, label: "Customers", href: "/customers", section: "People" },
  { icon: Users, label: "Employees", href: "/employees", section: "People" },
  { icon: Truck, label: "Suppliers", href: "/suppliers", section: "People" },
  { icon: Store, label: "Branches", href: "/branches", section: "Management" },
  { icon: FileText, label: "Reports", href: "/reports", section: "Management" },
  { icon: Settings, label: "Settings", href: "/settings", section: "Settings" },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  // Group items by section
  const sections = navItems.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, typeof navItems>);

  return (
    <div className="flex flex-col w-64 bg-sidebar border-r border-sidebar-border h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl leading-none">
          N
        </div>
        <span className="text-sidebar-foreground font-bold text-xl tracking-tight">NexusPOS</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6">
        {Object.entries(sections).map(([section, items]) => (
          <div key={section}>
            <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2 px-2">
              {section}
            </div>
            <div className="space-y-1">
              {items.map((item) => {
                const isActive = location.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer text-sm font-medium ${
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                      }`}
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-foreground font-bold">
            {user?.name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sidebar-foreground truncate">{user?.name}</div>
            <div className="text-xs text-sidebar-foreground/50 truncate capitalize">{user?.role?.replace("_", " ")}</div>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
          onClick={logout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Log out
        </Button>
      </div>
    </div>
  );
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden flex flex-col">
        <div className="flex-1 p-8">{children}</div>
      </main>
    </div>
  );
}

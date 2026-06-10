import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLogout } from "@workspace/api-client-react";
import { useCart } from "@/lib/cart";
import {
  LayoutDashboard, ShoppingBag, Wallet, Users, ClipboardList,
  LogOut, Menu, X, Shield, ChevronRight, ShoppingCart, Wifi,
} from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import FloatingChat from "@/components/FloatingChat";

interface NavItem {
  label: string;
  href: string;
  icon: any;
}

function getNavItems(role?: string): NavItem[] {
  if (role === "admin") return [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "All Orders", href: "/admin/orders", icon: ClipboardList },
    { label: "Agents", href: "/admin/agents", icon: Users },
    { label: "Products", href: "/admin/products", icon: ShoppingBag },
  ];
  if (role === "agent") return [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Buy Data", href: "/buy-data", icon: Wifi },
    { label: "My Orders", href: "/orders", icon: ShoppingBag },
    { label: "Wallet", href: "/wallet", icon: Wallet },
  ];
  return [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Buy Data", href: "/buy-data", icon: Wifi },
    { label: "My Orders", href: "/orders", icon: ShoppingBag },
  ];
}

const roleBadgeColors: Record<string, string> = {
  admin: "bg-red-500/20 text-red-300 border-red-500/30",
  agent: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  user: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, logout: clearAuth } = useAuth();
  const [location] = useLocation();
  const logoutMutation = useLogout();
  const { item } = useCart();
  const navItems = getNavItems(user?.role);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        clearAuth();
        onClose?.();
        window.location.href = "/";
      },
      onError: () => {
        // Logout even if API call fails
        clearAuth();
        onClose?.();
        window.location.href = "/";
      },
    });
  };

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <span className="text-white font-black text-base">E</span>
          </div>
          <div>
            <p className="font-bold text-sidebar-foreground text-base leading-tight">Kheliss data Hub</p>
            <p className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest">Data Reseller</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-sidebar-foreground/40 hover:text-sidebar-foreground">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-sidebar-foreground/30 text-[10px] uppercase tracking-widest font-semibold px-3 mb-3">
          {user?.role === "admin" ? "Administration" : "Navigation"}
        </p>
        {navItems.map((navItem) => {
          const Icon = navItem.icon;
          const isActive = location === navItem.href || (navItem.href === "/buy-data" && location === "/cart");
          return (
            <Link
              key={navItem.href}
              href={navItem.href}
              onClick={onClose}
              className={`sidebar-item ${isActive ? "active" : ""}`}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              <span className="flex-1">{navItem.label}</span>
              {navItem.href === "/buy-data" && item && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  1
                </span>
              )}
              {isActive && !item && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
            </Link>
          );
        })}

        {/* Cart link (non-admin) */}
        {user?.role !== "admin" && (
          <Link
            href="/cart"
            onClick={onClose}
            className={`sidebar-item ${location === "/cart" ? "active" : ""}`}
          >
            <ShoppingCart className="h-4.5 w-4.5 shrink-0" />
            <span className="flex-1">Cart</span>
            {item && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                1
              </span>
            )}
            {location === "/cart" && !item && <ChevronRight className="h-3.5 w-3.5 opacity-50" />}
          </Link>
        )}
      </nav>

      {/* User card */}
      <div className="px-3 pb-4">
        <div className="bg-sidebar-accent rounded-xl p-3 mb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-sidebar-border">
              <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">
                {user?.username?.replace("@", "").substring(0, 2).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sidebar-foreground text-sm font-semibold truncate">{user?.username}</p>
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium border rounded-full px-2 py-0.5 ${roleBadgeColors[user?.role || "user"]}`}>
                {user?.role === "admin" && <Shield className="h-2.5 w-2.5" />}
                {user?.role}
              </span>
            </div>
            {user?.role === "agent" && (
              <div className="text-right">
                <p className="text-sidebar-foreground/40 text-[9px] uppercase">Balance</p>
                <p className="text-sidebar-foreground text-xs font-bold">
                  ₵{(user?.walletBalance || 0).toFixed(2)}
                </p>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="sidebar-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { item } = useCart();
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-sidebar-border">
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative z-10 w-72 flex flex-col shadow-2xl">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-border">
          {/* Mobile: logo + hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-muted-foreground hover:text-foreground p-1"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="md:hidden flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-black text-xs">E</span>
            </div>
            <span className="font-bold text-sm text-foreground">Kheliss data Hub</span>
          </div>
          <div className="hidden md:block" />

          {/* Right: cart icon + avatar */}
          <div className="flex items-center gap-3">
            {user?.role !== "admin" && (
              <Link href="/cart" className="relative w-9 h-9 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <ShoppingCart className="h-4.5 w-4.5 text-muted-foreground" />
                {item && (
                  <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-primary flex items-center justify-center text-[9px] font-black text-white">
                    1
                  </span>
                )}
              </Link>
            )}
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-black text-sm">
                {user?.username?.replace("@", "").substring(0, 2).toUpperCase() || "U"}
              </span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Floating Chat Widget */}
      <FloatingChat />
    </div>
  );
}

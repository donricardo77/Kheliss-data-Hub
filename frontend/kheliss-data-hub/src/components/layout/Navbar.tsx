import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLogout } from "@workspace/api-client-react";
import { Menu, X, User, LogOut, LayoutDashboard, History, Wallet, Users, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Navbar() {
  const { user, logout: clearAuth } = useAuth();
  const [location, setLocation] = useLocation();
  const logoutMutation = useLogout();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        clearAuth();
        setIsOpen(false);
        setLocation("/");
      },
      onError: () => {
        // Logout even if API call fails (session might be lost)
        clearAuth();
        setIsOpen(false);
        setLocation("/");
      },
    });
  };

  const navItems = user?.role === "admin" 
    ? [
        { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
        { label: "Agents", href: "/admin/agents", icon: Users },
        { label: "All Orders", href: "/admin/orders", icon: History },
      ]
    : user?.role === "agent"
    ? [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "My Orders", href: "/orders", icon: History },
        { label: "Wallet", href: "/wallet", icon: Wallet },
      ]
    : user
    ? [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "My Orders", href: "/orders", icon: History },
      ]
    : [
        { label: "Features", href: "/#features" },
        { label: "Pricing", href: "/#pricing" },
      ];

  const UserMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 border-2 border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {user?.username?.substring(0, 2).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1.5 p-2 bg-muted/30 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Name</p>
              <p className="text-sm font-bold text-foreground">{user?.username}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Phone</p>
              <p className="text-sm font-mono text-foreground">{user?.phone || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Email</p>
              <p className="text-xs text-foreground break-all">{user?.email}</p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] uppercase tracking-wider font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {user?.role}
              </span>
              {user?.role === "agent" && (
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${user.isVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {user.isVerified ? 'Verified' : 'Pending'}
                </span>
              )}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:inline-block">Kheliss data Hub</span>
          </Link>

          {user && (
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-colors hover:text-primary px-4 py-2 rounded-md ${
                    location === item.href ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          {!user ? (
            <div className="hidden md:flex items-center gap-4">
              <Link href="/login" className="text-sm font-medium hover:text-primary transition-colors">
                Log in
              </Link>
              <Link href="/register">
                <Button>Get Started</Button>
              </Link>
            </div>
          ) : (
            <div className="hidden md:block">
              <UserMenu />
            </div>
          )}

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 mb-8">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                    <span className="text-white font-bold text-lg">E</span>
                  </div>
                  <span className="font-bold text-xl tracking-tight">Kheliss data Hub</span>
                </div>
                
                {user && (
                  <div className="mb-6 p-4 rounded-xl bg-muted/50 flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-primary/20">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {user.username?.substring(0, 2).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{user.username}</span>
                      <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
                    </div>
                  </div>
                )}

                <nav className="flex flex-col gap-2">
                  {navItems.map((item) => {
                    const Icon = 'icon' in item ? item.icon : undefined;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                          location === item.href 
                            ? "bg-primary text-primary-foreground" 
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {Icon && <Icon className="h-5 w-5" />}
                        {item.label}
                      </Link>
                    )
                  })}
                </nav>

                <div className="mt-auto pt-6 border-t flex flex-col gap-2">
                  {!user ? (
                    <>
                      <Link href="/login" onClick={() => setIsOpen(false)}>
                        <Button variant="outline" className="w-full justify-start">
                          Log in
                        </Button>
                      </Link>
                      <Link href="/register" onClick={() => setIsOpen(false)}>
                        <Button className="w-full justify-start">
                          Get Started
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive" 
                      onClick={() => {
                        handleLogout();
                        setIsOpen(false);
                      }}
                    >
                      <LogOut className="mr-2 h-5 w-5" />
                      Log out
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
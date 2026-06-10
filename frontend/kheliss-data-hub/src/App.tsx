import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { AppLayout } from "@/components/layout/AppLayout";
import React from "react";

import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Dashboard from "@/pages/dashboard";
import BuyData from "@/pages/buy-data";
import Cart from "@/pages/cart";
import Orders from "@/pages/orders";
import Wallet from "@/pages/wallet";
import PaymentCallback from "@/pages/payment-callback";
import PaystackReturn from "@/pages/paystack-return";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminAgents from "@/pages/admin/agents";
import AdminOrders from "@/pages/admin/orders";
import AdminProducts from "@/pages/admin/products";
import NotFound from "@/pages/not-found";

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4 p-4">
            <div className="text-2xl font-bold text-destructive">Something went wrong</div>
            <p className="text-muted-foreground max-w-md text-center">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: { 
    queries: { 
      retry: 1, 
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    }
  },
});

function ProtectedRoute({ component: Component, allowedRoles }: { component: any; allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Redirect to={user.role === "admin" ? "/admin" : "/dashboard"} />;
  }

  return <Component />;
}

function GuestRoute({ component: Component }: { component: any }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) return <Redirect to={user.role === "admin" ? "/admin" : "/dashboard"} />;

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">{() => <GuestRoute component={Login} />}</Route>
      <Route path="/register">{() => <GuestRoute component={Register} />}</Route>
      <Route path="/forgot-password">{() => <GuestRoute component={ForgotPassword} />}</Route>
      <Route path="/reset-password">{() => <ResetPassword />}</Route>

      <Route path="/dashboard">
        {() => (
          <AppLayout>
            <ProtectedRoute component={Dashboard} allowedRoles={["user", "agent"]} />
          </AppLayout>
        )}
      </Route>
      <Route path="/buy-data">
        {() => (
          <AppLayout>
            <ProtectedRoute component={BuyData} allowedRoles={["user", "agent"]} />
          </AppLayout>
        )}
      </Route>
      <Route path="/cart">
        {() => (
          <AppLayout>
            <ProtectedRoute component={Cart} allowedRoles={["user", "agent"]} />
          </AppLayout>
        )}
      </Route>
      <Route path="/orders">
        {() => (
          <AppLayout>
            <ProtectedRoute component={Orders} allowedRoles={["user", "agent"]} />
          </AppLayout>
        )}
      </Route>
      <Route path="/wallet">
        {() => (
          <AppLayout>
            <ProtectedRoute component={Wallet} allowedRoles={["agent"]} />
          </AppLayout>
        )}
      </Route>

      <Route path="/payment-callback">
        {() => <PaymentCallback />}
      </Route>

      <Route path="/paystack-return">
        {() => <PaystackReturn />}
      </Route>

      <Route path="/admin">
        {() => (
          <AppLayout>
            <ProtectedRoute component={AdminDashboard} allowedRoles={["admin"]} />
          </AppLayout>
        )}
      </Route>
      <Route path="/admin/agents">
        {() => (
          <AppLayout>
            <ProtectedRoute component={AdminAgents} allowedRoles={["admin"]} />
          </AppLayout>
        )}
      </Route>
      <Route path="/admin/orders">
        {() => (
          <AppLayout>
            <ProtectedRoute component={AdminOrders} allowedRoles={["admin"]} />
          </AppLayout>
        )}
      </Route>
      <Route path="/admin/products">
        {() => (
          <AppLayout>
            <ProtectedRoute component={AdminProducts} allowedRoles={["admin"]} />
          </AppLayout>
        )}
      </Route>

      <Route path="/">{() => <GuestRoute component={Login} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user } = useAuth();
  
  return (
    <CartProvider userId={user?._id}>
      <Router />
    </CartProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL || "/"}>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

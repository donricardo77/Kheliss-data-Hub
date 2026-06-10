import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateOrder, getGetOrdersQueryKey, getGetWalletQueryKey, useGetWallet } from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ShoppingCart, Wifi, Wallet, CreditCard, Loader2, ShoppingBag } from "lucide-react";
import { Link } from "wouter";

const NET_BG: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  MTN: { bg: "bg-yellow-50", text: "text-yellow-800", dot: "bg-yellow-400", border: "border-yellow-300" },
  Telecel: { bg: "bg-red-50", text: "text-red-800", dot: "bg-red-500", border: "border-red-300" },
  AirtelTigo: { bg: "bg-blue-50", text: "text-blue-900", dot: "bg-blue-600", border: "border-blue-300" },
};

export default function Cart() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { item, clearCart } = useCart();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAgent = user?.role === "agent";

  // Redirect to login if not authenticated
  if (!user) {
    return (
      <div className="p-6 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mb-5">
          <ShoppingCart className="h-10 w-10 text-muted-foreground opacity-40" />
        </div>
        <h2 className="text-xl font-black text-foreground mb-2">Authentication Required</h2>
        <p className="text-muted-foreground text-sm mb-6">Please log in to complete your purchase.</p>
        <Link href="/login">
          <Button className="gap-2">
            Log In
          </Button>
        </Link>
      </div>
    );
  }

  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "paystack">(isAgent ? "wallet" : "paystack");

  const { data: walletData } = useGetWallet({
    query: { enabled: isAgent, queryKey: getGetWalletQueryKey() },
  });

  // Use custom mutation with idempotency support
  const createOrderMutation = useMutation({
    mutationFn: async (data: { productId: string; recipientPhone: string; paymentMethod: "wallet" | "paystack" }) => {
      // Generate deterministic idempotency key (same for same order data = enables idempotency)
      // Uses only the order data itself, not timestamps or random values
      const idempotencyKey = `${user?.id}-${data.productId}-${data.recipientPhone}-${data.paymentMethod}`;
      
      // Import createOrder directly and pass custom headers
      const { createOrder } = await import("@workspace/api-client-react");
      return createOrder(data, {
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
      });
    },
  });

  if (!item) {
    return (
      <div className="p-6 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mb-5">
          <ShoppingCart className="h-10 w-10 text-muted-foreground opacity-40" />
        </div>
        <h2 className="text-xl font-black text-foreground mb-2">Cart is empty</h2>
        <p className="text-muted-foreground text-sm mb-6">Add a data bundle to get started.</p>
        <Link href="/buy-data">
          <Button className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            Buy Data Bundle
          </Button>
        </Link>
      </div>
    );
  }

  const net = NET_BG[item.network] || { bg: "bg-muted", text: "text-foreground", dot: "bg-muted-foreground", border: "border-border" };
  const price = isAgent ? item.agentPrice : item.userPrice;
  const canPayWallet = isAgent && walletData && walletData.balance >= price;

  const handleOrder = () => {
    if (!item) return;
    
    createOrderMutation.mutate(
      { productId: item.productId, recipientPhone: item.recipientPhone, paymentMethod },
      {
        onSuccess: (res) => {
          console.log('Payment initialization response:', res);
          
          // For Paystack: redirect to payment (order will be created after payment confirmation)
          // For Wallet: order was created immediately, so refresh queries
          if (paymentMethod === "wallet") {
            // Order created immediately for wallet payment, invalidate orders query
            queryClient.invalidateQueries({ 
              queryKey: getGetOrdersQueryKey() 
            });
            
            // Invalidate wallet balance
            queryClient.invalidateQueries({ 
              queryKey: getGetWalletQueryKey()
            });
            
            toast({ 
              title: "✓ Order placed successfully!", 
              description: res.message || "Your order has been processed" 
            });
            clearCart();
            
            // Navigate to dashboard to show the new order
            setTimeout(() => {
              navigate("/dashboard");
            }, 1500);
          } else if (paymentMethod === "paystack" && res.paymentUrl) {
            // For Paystack: redirect to payment
            // Order will be created after payment is confirmed via webhook or callback verification
            toast({ 
              title: "Redirecting to Paystack", 
              description: "Complete your payment to create the order" 
            });
            clearCart();
            
            // Give toast time to show before redirect to Paystack
            setTimeout(() => {
              window.location.href = res.paymentUrl;
            }, 800);
          } else {
            // Unexpected response
            toast({ 
              title: "Error", 
              description: "Unexpected response from server",
              variant: "destructive"
            });
          }
        },
        onError: (err: any) => {
          console.error('Order creation error:', err);
          console.error('Error response status:', err?.response?.status);
          console.error('Error response data:', err?.response?.data);
          let errorMsg = "Failed to place order";
          
          // Handle authentication errors
          if (err?.response?.status === 401) {
            errorMsg = "Your session has expired. Please log in again.";
            toast({ 
              title: "Session Expired", 
              description: errorMsg,
              variant: "destructive" 
            });
            // Redirect to login after showing toast
            setTimeout(() => {
              navigate("/login");
            }, 2000);
            return;
          }
          
          // Handle 502 errors (vendor API failures for wallet payments)
          if (err?.response?.status === 502) {
            errorMsg = err?.response?.data?.error || "Payment service temporarily unavailable. Please try again in a moment.";
            toast({
              title: "Payment Failed",
              description: errorMsg,
              variant: "destructive"
            });
            return;
          }
          
          // Try to extract detailed error message
          if (err?.response?.data?.error) {
            errorMsg = err.response.data.error;
          } else if (err?.response?.status === 403) {
            if (paymentMethod === "wallet") {
              errorMsg = "Agent account verification required for wallet payments";
            } else {
              errorMsg = "You don't have permission to use this payment method";
            }
          } else if (err?.response?.status === 400) {
            errorMsg = "Invalid order details. Please check your information";
          } else if (err?.message) {
            errorMsg = err.message;
          }
          
          toast({ 
            title: "Order Failed", 
            description: errorMsg,
            variant: "destructive" 
          });
        },
      }
    );
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate("/buy-data")}
          className="w-9 h-9 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-foreground">Checkout</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Review your order and pay</p>
        </div>
      </div>

      {/* Order card */}
      <div className={`rounded-2xl border-2 ${net.border} ${net.bg} p-5 mb-5`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center`}>
            <Wifi className={`h-5 w-5 ${net.text}`} />
          </div>
          <div>
            <p className={`font-black text-sm ${net.text}`}>{item.network}</p>
            <p className={`text-xs ${net.text} opacity-60`}>Data Bundle</p>
          </div>
        </div>
        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <span className={`text-sm font-medium ${net.text} opacity-70`}>Package</span>
            <span className={`text-sm font-bold ${net.text}`}>{item.name}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className={`text-sm font-medium ${net.text} opacity-70`}>Data</span>
            <span className={`text-sm font-bold ${net.text}`}>{item.dataAmount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className={`text-sm font-medium ${net.text} opacity-70`}>Recipient</span>
            <span className={`text-sm font-mono font-bold ${net.text}`}>{item.recipientPhone}</span>
          </div>
          <div className={`border-t border-current/10 pt-2.5 flex justify-between items-center`}>
            <span className={`text-sm font-semibold ${net.text}`}>Total</span>
            <span className={`text-2xl font-black ${net.text}`}>₵{(price || 0).toFixed(2)}</span>
          </div>
          {isAgent && (
            <p className={`text-xs ${net.text} opacity-50 text-right`}>Agent discounted rate</p>
          )}
        </div>
      </div>

      {/* Payment method */}
      <div className="mb-6">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Payment Method</p>
        <div className={`grid gap-3 ${isAgent ? "grid-cols-2" : "grid-cols-1"}`}>
          {isAgent && (
            <button
              onClick={() => setPaymentMethod("wallet")}
              className={`rounded-2xl border-2 p-4 text-left transition-all ${
                paymentMethod === "wallet"
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border bg-card hover:border-muted-foreground/30"
              }`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${paymentMethod === "wallet" ? "bg-primary/10" : "bg-muted"}`}>
                  <Wallet className={`h-4 w-4 ${paymentMethod === "wallet" ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <p className={`font-bold text-sm ${paymentMethod === "wallet" ? "text-primary" : "text-foreground"}`}>Agent Wallet</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Balance: <span className={`font-bold ${!canPayWallet ? "text-red-500" : "text-foreground"}`}>₵{(walletData?.balance || 0).toFixed(2)}</span>
              </p>
              {!canPayWallet && paymentMethod === "wallet" && (
                <p className="text-xs text-red-500 mt-1 font-medium">Insufficient balance</p>
              )}
            </button>
          )}
          <button
            onClick={() => setPaymentMethod("paystack")}
            className={`rounded-2xl border-2 p-4 text-left transition-all ${
              paymentMethod === "paystack"
                ? "border-primary bg-primary/5 shadow-md"
                : "border-border bg-card hover:border-muted-foreground/30"
            }`}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${paymentMethod === "paystack" ? "bg-primary/10" : "bg-muted"}`}>
                <CreditCard className={`h-4 w-4 ${paymentMethod === "paystack" ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <p className={`font-bold text-sm ${paymentMethod === "paystack" ? "text-primary" : "text-foreground"}`}>Pay with Paystack</p>
            </div>
            <p className="text-xs text-muted-foreground">Card, mobile money & more</p>
          </button>
        </div>
      </div>

      {/* Place Order */}
      <Button
        onClick={handleOrder}
        className="w-full h-12 font-bold text-base shadow-lg shadow-primary/20 gap-2"
        disabled={createOrderMutation.isPending || (paymentMethod === "wallet" && !canPayWallet)}
      >
        {createOrderMutation.isPending ? (
          <><Loader2 className="h-5 w-5 animate-spin" />Processing...</>
        ) : (
          <>Place Order · ₵{(price || 0).toFixed(2)}</>
        )}
      </Button>

      <button
        onClick={() => { clearCart(); navigate("/buy-data"); }}
        className="w-full mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
      >
        ← Change package
      </button>
    </div>
  );
}

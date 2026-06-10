import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useGetOrders, getGetOrdersQueryKey, useGetWallet, getGetWalletQueryKey, getGetMeQueryKey } from "@workspace/api-client-react";
import { Loader2, CheckCircle, XCircle, ShoppingBag, Wallet, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OrderData {
  id: string;
  userId: string;
  username: string;
  network: string;
  type: string;
  productName: string;
  recipientPhone: string;
  amount: number;
  status: "pending" | "processing" | "completed" | "failed";
  paymentMethod: string;
  paymentReference: string;
  vendorOrderId?: string;
  vendorStatus?: string;
  createdAt: string;
}

interface PaymentVerifyResponse {
  status: "success" | "failed";
  message: string;
  isWalletFund?: boolean;
  order?: OrderData;
  wallet?: {
    userId: string;
    amount: number;
    adminFee: number;
    totalCharged: number;
    type: string;
    reference: string;
    newBalance: number;
  };
}

export default function PaystackReturn() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [verifying, setVerifying] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "success" | "failed">("pending");
  const [verifiedOrder, setVerifiedOrder] = useState<OrderData | null>(null);
  const [walletUpdate, setWalletUpdate] = useState<any>(null);

  // Fetch latest orders and wallet to show current state
  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useGetOrders(
    { limit: 1, page: 1 },
    { query: { enabled: false, queryKey: getGetOrdersQueryKey({ limit: 1, page: 1 }) } }
  );

  const { data: walletData, refetch: refetchWallet } = useGetWallet(
    { query: { enabled: false, queryKey: getGetWalletQueryKey() } }
  );

  // On mount, refetch auth to restore session after Paystack redirect
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  }, [queryClient]);

  useEffect(() => {
    // Don't start verification until auth is loaded
    if (authLoading) {
      return;
    }

    const verifyPayment = async () => {
      try {
        const params = new URLSearchParams(search);
        const reference = params.get("reference");
        const accessCode = params.get("access_code");

        if (!reference) {
          setPaymentStatus("failed");
          toast({
            title: "Error",
            description: "No payment reference found. Please try again.",
            variant: "destructive",
          });
          setVerifying(false);
          return;
        }

        // Call backend to verify payment
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
        const response = await fetch(`${apiUrl}/api/payments/verify/${reference}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          credentials: "include",
        });

        const data = (await response.json()) as PaymentVerifyResponse;

        if (data.status === "success") {
          setPaymentStatus("success");

          if (data.isWalletFund && data.wallet) {
            setWalletUpdate(data.wallet);
            toast({
              title: "✓ Wallet Funded!",
              description: `Your wallet has been credited with ${data.wallet.amount} (Fee: ${data.wallet.adminFee})`,
            });
            
            // Invalidate wallet query to refresh
            queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
          } else if (data.order) {
            setVerifiedOrder(data.order);
            toast({
              title: "✓ Order Created!",
              description: `Your order for ${data.order.productName} to ${data.order.recipientPhone} has been confirmed.`,
            });

            // Invalidate orders queries
            queryClient.invalidateQueries({ queryKey: getGetOrdersQueryKey({})} );
          }

          // Refetch fresh data
          if (data.isWalletFund) {
            await refetchWallet();
          } else {
            await refetchOrders();
          }
        } else {
          setPaymentStatus("failed");
          toast({
            title: "Payment Failed",
            description: data.message || "Payment verification failed. Please contact support.",
            variant: "destructive",
          });
        }
      } catch (err) {
        console.error("Payment verification error:", err);
        setPaymentStatus("failed");
        toast({
          title: "Error",
          description: "Failed to verify payment. Please check your orders.",
          variant: "destructive",
        });
      } finally {
        setVerifying(false);
      }
    };

    verifyPayment();
  }, [search, authLoading, toast, queryClient, refetchOrders, refetchWallet]);

  // Show loading while auth is being restored after Paystack redirect
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          </div>
          <p className="text-muted-foreground">Restoring your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please log in to view your payment status.</p>
          <Button onClick={() => navigate("/login")}>Log In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md">
        <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
          {verifying ? (
            <>
              <div className="flex justify-center mb-6">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-2">Verifying Payment</h1>
              <p className="text-muted-foreground mb-6">
                Please wait while we verify your Paystack payment...
              </p>
              <p className="text-xs text-muted-foreground">
                Do not close this page or go back
              </p>
            </>
          ) : paymentStatus === "success" ? (
            <>
              <div className="flex justify-center mb-6">
                <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-2 text-green-600">Payment Successful!</h1>

              {walletUpdate ? (
                <div className="mb-6 text-left">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Wallet className="h-5 w-5 text-blue-600" />
                      <h3 className="font-semibold text-blue-900">Wallet Updated</h3>
                    </div>
                    <div className="space-y-2 text-sm text-blue-800">
                      <p>
                        <span className="font-medium">Amount Credited:</span> {walletUpdate.amount}
                      </p>
                      <p>
                        <span className="font-medium">Admin Fee:</span> {walletUpdate.adminFee}
                      </p>
                      <p>
                        <span className="font-medium">New Balance:</span> {walletUpdate.newBalance}
                      </p>
                    </div>
                  </div>
                </div>
              ) : verifiedOrder ? (
                <div className="mb-6 text-left">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ShoppingBag className="h-5 w-5 text-emerald-600" />
                      <h3 className="font-semibold text-emerald-900">Order Confirmed</h3>
                    </div>
                    <div className="space-y-2 text-sm text-emerald-800">
                      <p>
                        <span className="font-medium">Product:</span> {verifiedOrder.productName}
                      </p>
                      <p>
                        <span className="font-medium">Network:</span> {verifiedOrder.network}
                      </p>
                      <p>
                        <span className="font-medium">Recipient:</span> {verifiedOrder.recipientPhone}
                      </p>
                      <p>
                        <span className="font-medium">Status:</span>{" "}
                        <span className="capitalize font-semibold">
                          {verifiedOrder.status === "processing"
                            ? "Processing with vendor"
                            : verifiedOrder.status}
                        </span>
                      </p>
                      {verifiedOrder.vendorOrderId && (
                        <p>
                          <span className="font-medium">Vendor Order ID:</span>{" "}
                          {verifiedOrder.vendorOrderId}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              <p className="text-muted-foreground text-sm mb-6">
                You will be redirected to your order history shortly...
              </p>

              <div className="space-y-3">
                <Button
                  className="w-full"
                  onClick={() => navigate("/orders")}
                >
                  <span>Return to Dashboard (Order History)</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => navigate(user.role === "admin" ? "/admin" : "/dashboard")}
                >
                  {walletUpdate ? "View Wallet" : "Go to Main Dashboard"}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-6">
                <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-2 text-red-600">Payment Failed</h1>
              <p className="text-muted-foreground mb-6">
                We couldn't verify your payment. Please check your bank account to confirm if the amount was deducted, then try again.
              </p>

              <div className="space-y-3">
                <Button
                  className="w-full"
                  onClick={() => navigate("/orders")}
                >
                  View Order History
                </Button>
                <Button
                  className="w-full"
                  onClick={() => navigate(user.role === "admin" ? "/admin" : "/dashboard")}
                  variant="outline"
                >
                  Back to Dashboard
                </Button>
                <Button
                  className="w-full"
                  onClick={() => navigate("/buy-data")}
                  variant="ghost"
                >
                  Buy More Data
                </Button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {verifying ? (
            "Reference: Processing..."
          ) : (
            <>
              Need help?{" "}
              <a href="mailto:support@ewuradatahub.com" className="text-primary hover:underline">
                Contact Support
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

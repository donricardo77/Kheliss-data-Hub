import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentCallback() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [verifying, setVerifying] = useState(true);
  const [status, setStatus] = useState<"pending" | "success" | "failed">("pending");

  // On mount, refetch auth to restore session after Paystack redirect
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  }, [queryClient]);

  useEffect(() => {
    // Don't start verification until auth is loaded
    if (isLoading) {
      return;
    }

    const verifyPayment = async () => {
      try {
        // Get reference from query params - Paystack returns reference parameter
        const params = new URLSearchParams(search);
        const reference = params.get("reference");

        if (!reference) {
          setStatus("failed");
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

        const data = await response.json();

        if (data.status === "success") {
          setStatus("success");
          
          // Invalidate both wallet and orders queries to refresh data
          queryClient.invalidateQueries({ queryKey: ["/api/wallet"] });
          queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          
          // Get the product name to determine redirect destination
          const isWalletFund = !data.order?.productName;
          
          toast({
            title: "✓ Payment Successful!",
            description: isWalletFund 
              ? "Your wallet has been funded successfully!"
              : `Your order for ${data.order?.productName} has been confirmed.`,
          });

          // Don't auto-redirect - let user choose where to go
          // User can click buttons below to navigate
        } else {
          setStatus("failed");
          toast({
            title: "Payment Failed",
            description: data.message || "Payment verification failed. Please contact support.",
            variant: "destructive",
          });
        }
      } catch (err) {
        console.error("Payment verification error:", err);
        setStatus("failed");
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
  }, [search, navigate, toast, isLoading]);

  // Show loading while auth is being restored after Paystack redirect
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          </div>
          <p className="text-muted-foreground">Restoring session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please log in to view payment status.</p>
          <Button onClick={() => navigate("/login")}>Log In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
          {verifying ? (
            <>
              <div className="flex justify-center mb-6">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-2">Processing Payment</h1>
              <p className="text-muted-foreground mb-6">
                Please wait while we verify your payment...
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Do not close this page or go back</p>
              </div>
            </>
          ) : status === "success" ? (
            <>
              <div className="flex justify-center mb-6">
                <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h1 className="text-2xl font-bold mb-2 text-green-600">Payment Successful!</h1>
              <p className="text-muted-foreground mb-6">
                Your payment has been verified. You will be redirected to your orders shortly...
              </p>
              <Button
                className="w-full"
                onClick={() => navigate("/orders")}
              >
                View Orders
              </Button>
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
                We couldn't verify your payment. Please check your bank and try again.
              </p>
              <div className="space-y-3">
                <Button
                  className="w-full"
                  onClick={() => navigate("/orders")}
                  variant="outline"
                >
                  View Orders
                </Button>
                <Button
                  className="w-full"
                  onClick={() => navigate("/buy-data")}
                >
                  Try Again
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

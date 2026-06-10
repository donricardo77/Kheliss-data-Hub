import { useState } from "react";
import {
  useGetWallet, getGetWalletQueryKey,
  useGetWalletTransactions, getGetWalletTransactionsQueryKey,
  useFundWallet
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Wallet, ArrowDownCircle, ArrowUpCircle, Plus, Loader2, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

export default function WalletPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fundAmount, setFundAmount] = useState("");
  const [page, setPage] = useState(1);

  const { data: wallet, isLoading: walletLoading } = useGetWallet({
    query: { queryKey: getGetWalletQueryKey() }
  });
  const { data: txData, isLoading: txLoading } = useGetWalletTransactions(
    { limit: 10, page },
    { query: { queryKey: getGetWalletTransactionsQueryKey({ limit: 10, page }) } }
  );
  const fundMutation = useFundWallet();

  const handleFund = () => {
    const amount = parseFloat(fundAmount);
    if (!amount || amount < 1) {
      toast({ title: "Invalid amount", description: "Minimum top-up is ₵1.00", variant: "destructive" });
      return;
    }
    fundMutation.mutate({ data: { amount } }, {
      onSuccess: (res) => { window.location.href = res.authorizationUrl; },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.response?.data?.error || "Failed to initialize payment", variant: "destructive" });
      },
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-foreground">Agent Wallet</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Manage your wallet balance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-sidebar rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-white/50 text-xs font-semibold uppercase tracking-wider">Balance</span>
          </div>
          {walletLoading ? (
            <div className="h-8 w-24 bg-white/10 rounded animate-pulse" />
          ) : (
            <p className="text-3xl font-black text-white">₵{(wallet?.balance || 0).toFixed(2)}</p>
          )}
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Funded</span>
          </div>
          <p className="text-2xl font-black text-foreground">₵{(wallet?.totalFunded || 0).toFixed(2)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Spent</span>
          </div>
          <p className="text-2xl font-black text-foreground">₵{(wallet?.totalSpent || 0).toFixed(2)}</p>
        </div>
      </div>

      {/* Fund Wallet */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden mb-8">
        <div className="bg-sidebar px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Plus className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-white font-bold">Fund Wallet</h2>
        </div>
        <div className="p-5">
          {user?.isVerified ? (
            <>
              <div className="flex gap-3 max-w-sm mb-4">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₵</span>
                  <Input
                    data-testid="input-fund-amount"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    className="pl-8 h-11 font-mono text-lg"
                  />
                </div>
                <Button
                  data-testid="button-fund-wallet"
                  onClick={handleFund}
                  disabled={fundMutation.isPending || !fundAmount}
                  className="h-11 font-semibold shadow-lg shadow-primary/25 whitespace-nowrap"
                >
                  {fundMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fund via Paystack"}
                </Button>
              </div>

              {/* Fee Breakdown */}
              {fundAmount && parseFloat(fundAmount) >= 1 && (
                <div className="max-w-sm bg-muted/50 border border-border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Amount to receive:</span>
                    <span className="font-semibold text-foreground">₵{parseFloat(fundAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">4% Admin fee:</span>
                    <span className="font-semibold text-orange-500">-₵{(parseFloat(fundAmount) * 0.04).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between items-center text-sm">
                    <span className="font-bold text-foreground">Total to pay:</span>
                    <span className="font-bold text-foreground">₵{(parseFloat(fundAmount) * 1.04).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm">Verification Required</p>
                <p className="text-xs mt-0.5">Your account needs admin verification before you can fund your wallet.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-sidebar px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-white font-bold">Transaction History</h2>
        </div>

        {txLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !txData?.transactions?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <Wallet className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No transactions yet</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {txData.transactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === "credit" ? "bg-emerald-100" : "bg-red-100"}`}>
                    {tx.type === "credit"
                      ? <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
                      : <ArrowUpCircle className="h-5 w-5 text-red-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={`font-black text-base ${tx.type === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                    {tx.type === "credit" ? "+" : "−"}₵{(tx?.amount || 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            {txData.pages > 1 && (
              <div className="flex justify-center gap-2 p-4 border-t border-border">
                {Array.from({ length: txData.pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${page === p ? "bg-primary text-white" : "hover:bg-muted text-muted-foreground"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

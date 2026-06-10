import { Link } from "wouter";
import {
  useGetOrders, getGetOrdersQueryKey,
  useGetWallet, getGetWalletQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { ShoppingBag, Wifi, TrendingUp, CheckCircle, XCircle, Clock, Wallet, Loader2 } from "lucide-react";

const NET_STYLES: Record<string, { dot: string; bg: string }> = {
  MTN: { dot: "bg-yellow-400", bg: "bg-yellow-50" },
  Telecel: { dot: "bg-red-500", bg: "bg-red-50" },
  AirtelTigo: { dot: "bg-blue-600", bg: "bg-blue-50" },
};

const STATUS_STYLES: Record<string, { icon: any; bg: string; text: string }> = {
  completed: { icon: CheckCircle, bg: "bg-emerald-100", text: "text-emerald-700" },
  failed: { icon: XCircle, bg: "bg-red-100", text: "text-red-700" },
  pending: { icon: Clock, bg: "bg-amber-100", text: "text-amber-700" },
  processing: { icon: Clock, bg: "bg-blue-100", text: "text-blue-700" },
};

export default function Dashboard() {
  const { user } = useAuth();
  const isAgent = user?.role === "agent";

  const { data: ordersData, isLoading: ordersLoading, isError: ordersError } = useGetOrders(
    { limit: 8, page: 1 },
    { query: { 
      enabled: !!user,
      queryKey: getGetOrdersQueryKey({ limit: 8, page: 1 }),
      retry: 3,
      retryDelay: 500,
    } }
  );
  const { data: walletData } = useGetWallet({
    query: { 
      enabled: isAgent && !!user, 
      queryKey: getGetWalletQueryKey(),
      staleTime: 60_000,
      retry: 3,
      retryDelay: 500,
    },
  });

  const orders = ordersData?.orders ?? [];
  const totalOrders = ordersData?.total ?? 0;
  const completedOrders = orders.filter((o: any) => o.status === "completed").length;
  const successRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
  const totalGB = orders.reduce((sum: number, o: any) => {
    const val = o.productValue || o.productName || "";
    const match = val.match(/(\d+(\.\d+)?)\s*GB/i);
    return sum + (match ? parseFloat(match[1]) : 0);
  }, 0) || 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-800 via-blue-600 to-blue-400 p-7 mb-6 text-white shadow-lg shadow-blue-500/25 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.08),_transparent_60%)]" />
        <div className="relative">
          <p className="text-blue-200 text-sm font-medium mb-0.5">Welcome back,</p>
          <h1 className="text-2xl font-black mb-1">{user?.username}!</h1>
          <p className="text-blue-100 text-sm mb-5">Ready to top up? Get the best data bundles instantly.</p>
          <Link href="/buy-data">
            <button className="bg-yellow-400 hover:bg-yellow-300 text-yellow-900 font-bold px-5 py-2.5 rounded-xl text-sm transition-colors shadow-md">
              Buy Data Bundle
            </button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Orders", value: totalOrders, sub: "Lifetime transactions", icon: Wifi },
          { label: "Total GB Purchased", value: `${(totalGB || 0).toFixed(1)}`, sub: "Lifetime data purchased", icon: Wifi },
          { label: "Success Rate", value: `${successRate}%`, sub: "Order completion", icon: TrendingUp },
        ].map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Icon className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-3xl font-black text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Agent wallet */}
      {isAgent && walletData && (
        <div className="bg-sidebar rounded-2xl p-4 mb-6 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-white/50 text-xs uppercase tracking-wider">Agent Wallet</p>
              <p className="text-white text-xl font-black">₵{(walletData?.balance || 0).toFixed(2)}</p>
            </div>
          </div>
          <Link href="/wallet">
            <button className="bg-primary/20 hover:bg-primary/30 text-primary text-xs font-semibold px-4 py-2 rounded-xl transition-colors">
              View Wallet
            </button>
          </Link>
        </div>
      )}

      {/* Order History */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-bold text-foreground">Order History</h2>
          <Link href="/buy-data" className="text-blue-600 text-sm font-semibold hover:underline">
            New Order
          </Link>
        </div>

        {ordersLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !orders.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No transactions yet. Buy your first bundle!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 border-b border-border">
                  <th className="px-5 py-3">Network</th>
                  <th className="px-5 py-3">Package</th>
                  <th className="px-5 py-3">Recipient</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order: any) => {
                  const net = NET_STYLES[order.network] || { dot: "bg-muted-foreground", bg: "bg-muted" };
                  const st = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
                  const Icon = st.icon;
                  return (
                    <tr key={order.id} className="hover:bg-muted/20 transition-colors text-sm">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-md ${net.bg} flex items-center justify-center`}>
                            <div className={`w-2 h-2 rounded-full ${net.dot}`} />
                          </div>
                          <span className="font-semibold">{order.network}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-semibold">{order.productName}</td>
                      <td className="px-5 py-3.5 font-mono text-muted-foreground text-xs">{order.recipientPhone}</td>
                      <td className="px-5 py-3.5 font-black">₵{(order?.amount || 0).toFixed(2)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${order.paymentMethod === "wallet" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                          {order.paymentMethod}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>
                          <Icon className={`h-3 w-3 ${order.status === "pending" || order.status === "processing" ? "animate-spin" : ""}`} />
                          {order.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleDateString("en-GH")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

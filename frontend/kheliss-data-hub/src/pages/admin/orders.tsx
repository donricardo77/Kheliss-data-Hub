import { useState } from "react";
import { useGetAdminOrders, getGetAdminOrdersQueryKey } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShoppingBag, CheckCircle, XCircle, Clock } from "lucide-react";

const NET_STYLES: Record<string, { dot: string; bg: string }> = {
  MTN: { dot: "bg-yellow-400", bg: "bg-yellow-50" },
  Telecel: { dot: "bg-red-500", bg: "bg-red-50" },
  AirtelTigo: { dot: "bg-blue-600", bg: "bg-blue-50" },
};

const STATUS_CONFIG: Record<string, { icon: any; bg: string; text: string; label: string }> = {
  completed: { icon: CheckCircle, bg: "bg-emerald-100", text: "text-emerald-700", label: "Completed" },
  failed: { icon: XCircle, bg: "bg-red-100", text: "text-red-700", label: "Failed" },
  pending: { icon: Clock, bg: "bg-amber-100", text: "text-amber-700", label: "Pending" },
  processing: { icon: Clock, bg: "bg-blue-100", text: "text-blue-700", label: "Processing" },
};

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [page, setPage] = useState(1);

  const params: any = { limit: 20, page };
  if (statusFilter !== "all") params.status = statusFilter;
  if (networkFilter !== "all") params.network = networkFilter;

  const { data, isLoading } = useGetAdminOrders(params, {
    query: { queryKey: getGetAdminOrdersQueryKey(params) }
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-foreground">All Orders</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Platform-wide order management</p>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-sidebar px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <ShoppingBag className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-white font-bold flex-1">Orders</h2>
          <div className="flex items-center gap-3">
            {data && <span className="text-white/40 text-xs">{data.total} total</span>}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs bg-white/10 border-white/10 text-white/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={networkFilter} onValueChange={setNetworkFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs bg-white/10 border-white/10 text-white/80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Networks</SelectItem>
                <SelectItem value="MTN">MTN</SelectItem>
                <SelectItem value="Telecel">Telecel</SelectItem>
                <SelectItem value="AirtelTigo">AirtelTigo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.orders?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-semibold">No orders found</p>
            <p className="text-sm mt-1 text-muted-foreground/60">Try changing filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 border-b border-border">
                    <th className="px-5 py-3">User</th>
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
                  {data.orders.map((order: any) => {
                    const net = NET_STYLES[order.network] || { dot: "bg-muted-foreground", bg: "bg-muted" };
                    const st = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                    const Icon = st.icon;
                    return (
                      <tr key={order.id} className="hover:bg-muted/20 transition-colors text-sm">
                        <td className="px-5 py-3.5 font-semibold">{order.username}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-md ${net.bg} flex items-center justify-center`}>
                              <div className={`w-2 h-2 rounded-full ${net.dot}`} />
                            </div>
                            <span className="font-medium">{order.network}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">{order.productName}</td>
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
                            {st.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString("en-GH")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data.pages > 1 && (
              <div className="flex justify-center gap-1.5 p-4 border-t border-border">
                {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
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

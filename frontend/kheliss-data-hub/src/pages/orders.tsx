import { useState, useEffect } from "react";
import { useGetOrders, getGetOrdersQueryKey } from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShoppingBag, CheckCircle, XCircle, Clock, MoreVertical } from "lucide-react";
import OrderComplaintDialog from "@/components/OrderComplaintDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NETWORKS: Record<string, { dot: string; bg: string; text: string }> = {
  MTN: { dot: "bg-yellow-400", bg: "bg-yellow-50", text: "text-yellow-800" },
  Telecel: { dot: "bg-red-500", bg: "bg-red-50", text: "text-red-800" },
  AirtelTigo: { dot: "bg-blue-600", bg: "bg-blue-50", text: "text-blue-900" },
};

const statusConfig: Record<string, { icon: any; bg: string; text: string; label: string }> = {
  completed: { icon: CheckCircle, bg: "bg-emerald-100", text: "text-emerald-700", label: "Completed" },
  failed: { icon: XCircle, bg: "bg-red-100", text: "text-red-700", label: "Failed" },
  pending: { icon: Clock, bg: "bg-amber-100", text: "text-amber-700", label: "Pending" },
  processing: { icon: Clock, bg: "bg-blue-100", text: "text-blue-700", label: "Processing" },
};

const paymentBadge: Record<string, string> = {
  paystack: "bg-blue-100 text-blue-700",
  wallet: "bg-purple-100 text-purple-700",
};

export default function Orders() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [refetchInterval, setRefetchInterval] = useState<number | false>(false);
  const [selectedOrderForComplaint, setSelectedOrderForComplaint] = useState<any>(null);
  const [isComplaintDialogOpen, setIsComplaintDialogOpen] = useState(false);

  const params: any = { limit: 15, page };
  if (statusFilter !== "all") params.status = statusFilter;
  if (networkFilter !== "all") params.network = networkFilter;

  const { data, isLoading, refetch } = useGetOrders(params, {
    query: { 
      queryKey: getGetOrdersQueryKey(params),
      retry: 3,
      retryDelay: 500,
      refetchInterval, // Will refetch at this interval if set
      staleTime: 10_000, // 10 seconds
    }
  });

  // Enable polling if there are processing orders
  useEffect(() => {
    if (data?.orders) {
      const hasProcessingOrders = data.orders.some((order: any) => order.status === "processing");
      if (hasProcessingOrders) {
        setRefetchInterval(3000); // Poll every 3 seconds if there are processing orders
      } else {
        setRefetchInterval(false); // Stop polling if no processing orders
      }
    }
  }, [data?.orders]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-foreground">My Orders</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Your complete order history</p>
      </div>

      {/* Complaint Dialog */}
      {selectedOrderForComplaint && (
        <OrderComplaintDialog
          isOpen={isComplaintDialogOpen}
          onOpenChange={setIsComplaintDialogOpen}
          order={selectedOrderForComplaint}
        />
      )}

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {/* Filters */}
        <div className="px-5 py-4 border-b border-border flex flex-wrap gap-3 items-center justify-between bg-muted/20">
          <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-9 text-sm">
                <SelectValue placeholder="All Status" />
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
              <SelectTrigger className="w-[150px] h-9 text-sm">
                <SelectValue placeholder="All Networks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Networks</SelectItem>
                <SelectItem value="MTN">MTN</SelectItem>
                <SelectItem value="Telecel">Telecel</SelectItem>
                <SelectItem value="AirtelTigo">AirtelTigo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {data && (
            <span className="text-xs text-muted-foreground font-medium">{data.total} order{data.total !== 1 ? "s" : ""}</span>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.orders?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-semibold">No orders found</p>
            <p className="text-sm mt-1 text-muted-foreground/60">Try changing your filters</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
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
                    <th className="px-5 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.orders.map((order: any) => {
                    const net = NETWORKS[order.network] || { dot: "bg-muted-foreground", bg: "bg-muted", text: "text-muted-foreground" };
                    const st = statusConfig[order.status] || statusConfig.pending;
                    const Icon = st.icon;
                    return (
                      <tr key={order.id} className="hover:bg-muted/20 transition-colors text-sm">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-lg ${net.bg} flex items-center justify-center`}>
                              <div className={`w-2 h-2 rounded-full ${net.dot}`} />
                            </div>
                            <span className="font-semibold">{order.network}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-medium">{order.productName}</td>
                        <td className="px-5 py-3.5 font-mono text-muted-foreground">{order.recipientPhone}</td>
                        <td className="px-5 py-3.5 font-black text-foreground">₵{(order?.amount || 0).toFixed(2)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${paymentBadge[order.paymentMethod] || "bg-muted text-muted-foreground"}`}>
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
                        <td className="px-5 py-3.5 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="hover:bg-muted p-1.5 rounded-lg transition-colors">
                              <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedOrderForComplaint(order);
                                  setIsComplaintDialogOpen(true);
                                }}
                              >
                                Report Issue
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View - Slide Animation */}
            <div className="md:hidden space-y-3 p-4">
              {data.orders.map((order: any, idx: number) => {
                const net = NETWORKS[order.network] || { dot: "bg-muted-foreground", bg: "bg-muted", text: "text-muted-foreground" };
                const st = statusConfig[order.status] || statusConfig.pending;
                const Icon = st.icon;
                return (
                  <div key={order.id} className="slide-in-left" data-delay={Math.min(idx, 7)}>
                    <div className="bg-muted/40 rounded-xl p-4 border border-border/50 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg ${net.bg} flex items-center justify-center flex-shrink-0`}>
                            <div className={`w-2.5 h-2.5 rounded-full ${net.dot}`} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">Network</p>
                            <p className="font-bold text-sm">{order.network}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${st.bg} ${st.text}`}>
                            <Icon className={`h-3 w-3 ${order.status === "pending" || order.status === "processing" ? "animate-spin" : ""}`} />
                            {st.label}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger className="hover:bg-muted p-1.5 rounded-lg transition-colors">
                              <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedOrderForComplaint(order);
                                  setIsComplaintDialogOpen(true);
                                }}
                              >
                                Report Issue
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground">Package</p>
                          <p className="font-bold text-sm">{order.productName}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">Recipient</p>
                            <p className="font-mono text-xs text-foreground">{order.recipientPhone}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">Amount</p>
                            <p className="font-black text-sm">₵{(order?.amount || 0).toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">Payment</p>
                            <span className={`text-xs font-semibold px-2 py-1 rounded block w-fit capitalize ${paymentBadge[order.paymentMethod] || "bg-muted text-muted-foreground"}`}>
                              {order.paymentMethod}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">Date</p>
                            <p className="text-xs text-foreground">{new Date(order.createdAt).toLocaleDateString("en-GH")}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {data.pages > 1 && (
              <div className="flex justify-center gap-1.5 p-4 border-t border-border">
                {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${page === p ? "bg-primary text-white shadow-sm" : "hover:bg-muted text-muted-foreground"}`}
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

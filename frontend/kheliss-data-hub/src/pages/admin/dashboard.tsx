import { useState } from "react";
import {
  useGetAdminStats, getGetAdminStatsQueryKey,
  useGetAdminOrders, getGetAdminOrdersQueryKey,
  useGetAdminAgents, getGetAdminAgentsQueryKey,
  useVerifyAgent, useAdjustAgentBalance,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, ShoppingBag, CheckCircle, Clock, Users, BadgeCheck,
  TrendingUp, XCircle, Wallet, BadgeX, ChevronDown, ChevronUp,
} from "lucide-react";

const NET_STYLES: Record<string, { dot: string; bg: string }> = {
  MTN: { dot: "bg-yellow-400", bg: "bg-yellow-50" },
  Telecel: { dot: "bg-red-500", bg: "bg-red-50" },
  AirtelTigo: { dot: "bg-blue-600", bg: "bg-blue-50" },
};

const STATUS_CFG: Record<string, { icon: any; bg: string; text: string }> = {
  completed: { icon: CheckCircle, bg: "bg-emerald-100", text: "text-emerald-700" },
  failed: { icon: XCircle, bg: "bg-red-100", text: "text-red-700" },
  pending: { icon: Clock, bg: "bg-amber-100", text: "text-amber-700" },
  processing: { icon: Clock, bg: "bg-blue-100", text: "text-blue-700" },
};

type Tab = "orders" | "agents";

export default function AdminDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("orders");


  const { data: stats, isLoading: statsLoading, isError: statsError } = useGetAdminStats({
    query: { 
      queryKey: getGetAdminStatsQueryKey(),
      retry: 3,
      retryDelay: 500,
    },
  });

  const [statusFilter, setStatusFilter] = useState("all");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [orderPage, setOrderPage] = useState(1);
  const orderParams: any = { limit: 15, page: orderPage };
  if (statusFilter !== "all") orderParams.status = statusFilter;
  if (networkFilter !== "all") orderParams.network = networkFilter;
  const { data: ordersData = { orders: [], total: 0, page: 1, pages: 1 }, isLoading: ordersLoading, isError: ordersError } = useGetAdminOrders(orderParams, {
    query: { 
      queryKey: getGetAdminOrdersQueryKey(orderParams),
      retry: 3,
      retryDelay: 500,
    },
  });

  const [agentPage, setAgentPage] = useState(1);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState<"credit" | "debit">("credit");
  const [adjustReason, setAdjustReason] = useState("");
  const agentParams: any = { limit: 20, page: agentPage };
  const { data: agentsData = { agents: [], total: 0, page: 1, pages: 1 }, isLoading: agentsLoading, isError: agentsError } = useGetAdminAgents(agentParams, {
    query: { 
      queryKey: getGetAdminAgentsQueryKey(agentParams),
      retry: 3,
      retryDelay: 500,
    },
  });
  const verifyMutation = useVerifyAgent();
  const adjustBalanceMutation = useAdjustAgentBalance();

  const handleVerify = (agentId: string, current: boolean) => {
    verifyMutation.mutate({ id: agentId, data: { isVerified: !current } }, {
      onSuccess: () => {
        toast({ title: `Agent account ${!current ? "approved" : "denied"} successfully` });
        queryClient.invalidateQueries({ queryKey: getGetAdminAgentsQueryKey(agentParams) });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
      },
      onError: () => toast({ title: "Error", description: "Failed to update agent", variant: "destructive" }),
    });
  };

  const handleAdjust = (agentId: string) => {
    const amount = parseFloat(adjustAmount);
    if (!amount || !adjustReason.trim()) {
      toast({ title: "Missing fields", description: "Enter amount and reason", variant: "destructive" });
      return;
    }
    adjustBalanceMutation.mutate({ id: agentId, data: { amount, type: adjustType, reason: adjustReason } }, {
      onSuccess: () => {
        toast({ title: "Balance adjusted successfully" });
        queryClient.invalidateQueries({ queryKey: getGetAdminAgentsQueryKey(agentParams) });
        setAdjustingId(null);
        setAdjustAmount("");
        setAdjustReason("");
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err?.response?.data?.error || "Failed to adjust balance", variant: "destructive" });
      },
    });
  };



  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-black text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">God's view — full platform control</p>
      </div>

      {/* Stats spotlight */}
      {statsLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : statsError ? (
        <div className="text-center py-8 text-red-600">
          <p className="text-sm mb-2">Failed to load admin stats</p>
        </div>
      ) : (
        <>
          <div className="bg-sidebar rounded-2xl p-6 mb-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">Total Platform Revenue</p>
              <p className="text-4xl font-black text-white">₵{(stats?.totalRevenue || 0).toFixed(2)}</p>
              <p className="text-white/40 text-xs mt-1">From completed orders only</p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {[
              { label: "Total Orders", value: stats?.totalOrders ?? 0, icon: ShoppingBag, color: "text-primary", bg: "bg-primary/10" },
              { label: "Completed", value: stats?.completedOrders ?? 0, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-100" },
              { label: "Pending", value: stats?.pendingOrders ?? 0, icon: Clock, color: "text-amber-600", bg: "bg-amber-100" },
              { label: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, color: "text-blue-600", bg: "bg-blue-100" },
              { label: "Verified Agents", value: `${stats?.verifiedAgents ?? 0}/${stats?.totalAgents ?? 0}`, icon: BadgeCheck, color: "text-purple-600", bg: "bg-purple-100" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${bg}`}>
                  <Icon className={`h-4.5 w-4.5 ${color}`} />
                </div>
                <p className="text-2xl font-black text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl mb-6 w-fit">
        {([
          { id: "orders" as Tab, label: "All Orders", icon: ShoppingBag },
          { id: "agents" as Tab, label: "Agents", icon: Users },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === id ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ORDERS TAB */}
      {tab === "orders" && (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-sidebar px-5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-white font-bold flex-1">All Orders</h2>
            {ordersData && <span className="text-white/40 text-xs">{ordersData.total} total</span>}
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setOrderPage(1); }}>
              <SelectTrigger className="w-[130px] h-8 text-xs bg-white/10 border-white/10 text-white/80 hover:bg-white/20">
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
            <Select value={networkFilter} onValueChange={(v) => { setNetworkFilter(v); setOrderPage(1); }}>
              <SelectTrigger className="w-[130px] h-8 text-xs bg-white/10 border-white/10 text-white/80 hover:bg-white/20">
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

          {ordersLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : ordersError ? (
            <div className="text-center py-16 text-red-600">
              <p className="text-sm mb-2">Failed to load orders</p>
            </div>
          ) : !ordersData?.orders?.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="font-semibold">No orders found</p>
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
                    {ordersData.orders.map((order: any) => {
                      const net = NET_STYLES[order.network] || { dot: "bg-muted-foreground", bg: "bg-muted" };
                      const st = STATUS_CFG[order.status] || STATUS_CFG.pending;
                      const Icon = st.icon;
                      return (
                        <tr key={order.id} className="hover:bg-muted/20 transition-colors text-sm">
                          <td className="px-5 py-3.5 font-semibold">{order.username}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded-md ${net.bg} flex items-center justify-center`}>
                                <div className={`w-2 h-2 rounded-full ${net.dot}`} />
                              </div>
                              <span>{order.network}</span>
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
                              <Icon className="h-3 w-3" />
                              {order.status}
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
              {ordersData.pages > 1 && (
                <div className="flex justify-center gap-1.5 p-4 border-t border-border">
                  {Array.from({ length: ordersData.pages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setOrderPage(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${orderPage === p ? "bg-primary text-white" : "hover:bg-muted text-muted-foreground"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* AGENTS TAB */}
      {tab === "agents" && (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-sidebar px-5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-white font-bold flex-1">All Agents</h2>
            {agentsData && <span className="text-white/40 text-xs">{agentsData.total} agents</span>}
          </div>

          {agentsLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : agentsError ? (
            <div className="text-center py-16 text-red-600">
              <p className="text-sm mb-2">Failed to load agents</p>
            </div>
          ) : !agentsData?.agents?.length ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="font-semibold">No agents found</p>
            </div>
          ) : (
            <div>
              {agentsData.agents.map((agent: any) => (
                <div key={agent.id} className="border-b border-border last:border-b-0">
                  <div className="px-5 py-4 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-primary font-black text-sm">
                          {agent.username.replace("@", "").substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm text-foreground">{agent.username}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${agent.isVerified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {agent.isVerified ? "✓ Verified" : "⏳ Pending"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{agent.email} · {agent.phone}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-sidebar rounded-xl px-4 py-2">
                      <Wallet className="h-3.5 w-3.5 text-primary" />
                      <div>
                        <p className="text-white/50 text-[9px] uppercase">Balance</p>
                        <p className="text-white text-sm font-black">₵{(agent?.walletBalance || 0).toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={agent.isVerified ? "outline" : "default"}
                        onClick={() => handleVerify(agent.id, agent.isVerified)}
                        disabled={verifyMutation.isPending}
                        className={`gap-1.5 h-8 text-xs font-semibold ${agent.isVerified ? "border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300" : ""}`}
                      >
                        {agent.isVerified
                          ? <><BadgeX className="h-3.5 w-3.5" /> Deny</>
                          : <><BadgeCheck className="h-3.5 w-3.5" /> Approve</>
                        }
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setAdjustingId(adjustingId === agent.id ? null : agent.id)}
                        className="gap-1.5 h-8 text-xs font-semibold"
                      >
                        <Wallet className="h-3.5 w-3.5" />
                        Top Up
                        {adjustingId === agent.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>

                  {adjustingId === agent.id && (
                    <div className="mx-5 mb-4 bg-muted/40 border border-border rounded-xl p-4">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Adjust Wallet Balance</p>
                      <div className="flex flex-wrap gap-3 items-end">
                        <div>
                          <label className="text-xs font-semibold text-foreground/60 block mb-1">Type</label>
                          <Select value={adjustType} onValueChange={(v) => setAdjustType(v as "credit" | "debit")}>
                            <SelectTrigger className="w-[110px] h-9 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="credit">+ Credit</SelectItem>
                              <SelectItem value="debit">− Debit</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-foreground/60 block mb-1">Amount (₵)</label>
                          <Input
                            type="number" min="0" step="0.01" placeholder="0.00"
                            value={adjustAmount}
                            onChange={(e) => setAdjustAmount(e.target.value)}
                            className="w-[120px] h-9 text-sm font-mono"
                          />
                        </div>
                        <div className="flex-1 min-w-[180px]">
                          <label className="text-xs font-semibold text-foreground/60 block mb-1">Reason</label>
                          <Input
                            placeholder="Reason for adjustment"
                            value={adjustReason}
                            onChange={(e) => setAdjustReason(e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleAdjust(agent.id)}
                            disabled={adjustBalanceMutation.isPending}
                            className={`h-9 font-semibold ${adjustType === "credit" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
                          >
                            {adjustBalanceMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `Apply ${adjustType === "credit" ? "Credit" : "Debit"}`}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setAdjustingId(null)} className="h-9">Cancel</Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {agentsData.pages > 1 && (
                <div className="flex justify-center gap-1.5 p-4 border-t border-border">
                  {Array.from({ length: agentsData.pages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setAgentPage(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${agentPage === p ? "bg-primary text-white" : "hover:bg-muted text-muted-foreground"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}


    </div>
  );
}

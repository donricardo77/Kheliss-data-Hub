import { useState } from "react";
import {
  useGetAdminAgents, getGetAdminAgentsQueryKey,
  useVerifyAgent, useAdjustAgentBalance
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, BadgeCheck, BadgeX, Wallet, ChevronDown, ChevronUp } from "lucide-react";

export default function AdminAgents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState<"credit" | "debit">("credit");
  const [adjustReason, setAdjustReason] = useState("");

  const params: any = { limit: 15, page };

  const { data, isLoading } = useGetAdminAgents(params, {
    query: { 
      queryKey: getGetAdminAgentsQueryKey(params),
      retry: 3,
      retryDelay: 500,
    }
  });
  const verifyMutation = useVerifyAgent();
  const adjustBalanceMutation = useAdjustAgentBalance();

  const handleVerify = (agentId: string, current: boolean) => {
    verifyMutation.mutate({ id: agentId, data: { isVerified: !current } }, {
      onSuccess: () => {
        toast({ title: `Agent account ${!current ? "approved" : "denied"} successfully` });
        queryClient.invalidateQueries({ queryKey: getGetAdminAgentsQueryKey(params) });
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
        queryClient.invalidateQueries({ queryKey: getGetAdminAgentsQueryKey(params) });
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
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-foreground">Manage Agents</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Verify agents and manage wallet balances</p>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-sidebar px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-white font-bold flex-1">All Agents</h2>
          {data && <span className="text-white/40 text-xs">{data.total} agents</span>}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.agents?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-semibold">No agents found</p>
          </div>
        ) : (
          <div>
            {data.agents.map((agent: any, idx: number) => (
              <div key={agent.id} className="border-b border-border last:border-b-0 slide-in-left" data-delay={Math.min(idx, 7)}>
                {/* Agent row */}
                <div className="px-5 py-4 flex flex-wrap items-center gap-4">
                  {/* Avatar + info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-black text-sm">
                        {agent.username.replace("@", "").substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-foreground">{agent.username}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${agent.isVerified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {agent.isVerified ? "✓ Verified" : "Pending"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{agent.email} · {agent.phone}</p>
                    </div>
                  </div>

                  {/* Balance badge */}
                  <div className="flex items-center gap-2 bg-sidebar rounded-xl px-4 py-2">
                    <Wallet className="h-3.5 w-3.5 text-primary" />
                    <span className="text-white text-sm font-black">₵{(agent?.walletBalance || 0).toFixed(2)}</span>
                  </div>

                  {/* Actions */}
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
                      Balance
                      {adjustingId === agent.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>

                {/* Balance adjustment panel */}
                {adjustingId === agent.id && (
                  <div className="mx-5 mb-4 bg-muted/40 border border-border rounded-xl p-4">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Adjust Wallet Balance</p>
                    <div className="flex flex-wrap gap-3 items-end">
                      <div>
                        <label className="text-xs font-semibold text-foreground/60 block mb-1">Type</label>
                        <Select value={adjustType} onValueChange={(v) => setAdjustType(v as "credit" | "debit")}>
                          <SelectTrigger className="w-[110px] h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="credit">+ Credit</SelectItem>
                            <SelectItem value="debit">− Debit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-foreground/60 block mb-1">Amount (₵)</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
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
          </div>
        )}
      </div>
    </div>
  );
}

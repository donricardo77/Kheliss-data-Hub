import { useState } from "react";
import { useLocation } from "wouter";
import { useGetProducts, getGetProductsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, ShoppingCart, Wifi } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const NETWORKS = [
  {
    id: "MTN" as const,
    label: "MTN",
    sub: "Mobile Telecom Network",
    dot: "bg-yellow-400",
    border: "border-yellow-400",
    ring: "focus:ring-yellow-400/30",
    bg: "bg-yellow-50",
    activeBg: "bg-yellow-400/10",
    text: "text-yellow-800",
    badge: "bg-yellow-400",
  },
  {
    id: "Telecel" as const,
    label: "Telecel",
    sub: "Telecel Ghana",
    dot: "bg-red-500",
    border: "border-red-500",
    ring: "focus:ring-red-500/30",
    bg: "bg-red-50",
    activeBg: "bg-red-500/10",
    text: "text-red-800",
    badge: "bg-red-500",
  },
  {
    id: "AirtelTigo" as const,
    label: "AirtelTigo",
    sub: "Airtel & Tigo Ghana",
    dot: "bg-blue-600",
    border: "border-blue-600",
    ring: "focus:ring-blue-600/30",
    bg: "bg-blue-50",
    activeBg: "bg-blue-600/10",
    text: "text-blue-900",
    badge: "bg-blue-600",
  },
];

export default function BuyData() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { setItem } = useCart();
  const { toast } = useToast();
  const isAgent = user?.role === "agent";

  const [selectedNetwork, setSelectedNetwork] = useState<"MTN" | "Telecel" | "AirtelTigo" | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const net = NETWORKS.find(n => n.id === selectedNetwork);

  const { data: products = [], isLoading, isError, error } = useGetProducts(
    { network: selectedNetwork!, type: "data" },
    {
      query: {
        enabled: !!selectedNetwork,
        queryKey: getGetProductsQueryKey({ network: selectedNetwork!, type: "data" }),
        retry: 3,
        retryDelay: 500,
      },
    }
  );

  const selectedProduct = products?.find((p: any) => p._id === selectedProductId);
  const price = selectedProduct ? (isAgent ? selectedProduct.agentPrice : selectedProduct.userPrice) : 0;

  const handleAddToCart = () => {
    if (!selectedProduct || !selectedNetwork) return;
    if (!/^\d{10}$/.test(phone)) {
      setPhoneError("Phone must be exactly 10 digits");
      return;
    }
    setPhoneError("");
    setItem({
      productId: selectedProduct._id,
      network: selectedNetwork,
      name: selectedProduct.name,
      description: selectedProduct.description || "",
      userPrice: selectedProduct.userPrice,
      agentPrice: selectedProduct.agentPrice,
      dataAmount: selectedProduct.dataAmount,
      recipientPhone: phone,
    });
    toast({ title: "Added to cart!", description: `${selectedProduct.name} for ${phone}` });
    navigate("/cart");
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate("/dashboard")}
          className="w-9 h-9 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-foreground">Buy Data Bundle</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Select a network and choose your package</p>
        </div>
      </div>

      {/* Step 1: Network selection */}
      <div className="mb-8">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Step 1 — Choose Network</p>
        <div className="grid grid-cols-3 gap-4">
          {NETWORKS.map((network) => {
            const active = selectedNetwork === network.id;
            return (
              <button
                key={network.id}
                onClick={() => { setSelectedNetwork(network.id); setSelectedProductId(null); }}
                className={`relative rounded-2xl border-2 p-5 text-left transition-all ${
                  active
                    ? `${network.border} ${network.activeBg} shadow-md`
                    : "border-border hover:border-muted-foreground/30 bg-card"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl ${network.badge} flex items-center justify-center mb-3 shadow-md`}>
                  <Wifi className="h-5 w-5 text-white" />
                </div>
                <p className={`font-black text-base ${active ? network.text : "text-foreground"}`}>{network.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{network.sub}</p>
                {active && (
                  <div className={`absolute top-3 right-3 w-5 h-5 rounded-full ${network.badge} flex items-center justify-center`}>
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Agent Verification Check */}
      {isAgent && !user?.isVerified && (
        <div className="mb-8 bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <div className="flex gap-4">
            <div className="text-amber-600 text-2xl">⚠️</div>
            <div>
              <h3 className="font-black text-amber-900 mb-1">Account Not Approved</h3>
              <p className="text-sm text-amber-800 mb-2">Your agent account is pending approval. Once approved by an admin, you'll be able to purchase data packages and access all agent features.</p>
              <p className="text-xs text-amber-700">Status: <span className="font-bold">Pending Review</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Package selection */}
      {selectedNetwork && (
        <div className="mb-8">
          {isAgent && !user?.isVerified ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm mb-2">Packages are available once your account is approved</p>
              <p className="text-xs text-muted-foreground/60">Please wait for admin approval to proceed</p>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
                Step 2 — Choose Package
                <span className={`ml-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-white text-[10px] font-bold ${net?.badge}`}>
                  <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
                  {net?.label}
                </span>
              </p>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : isError ? (
                <div className="text-center py-12 text-red-600">
                  <p className="text-sm mb-2">Failed to load packages</p>
                  <p className="text-xs text-muted-foreground">{error?.message || "Unknown error"}</p>
                </div>
              ) : products && products.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {products.map((pkg: any) => {
                    const active = selectedProductId === pkg._id;
                    const pkgPrice = isAgent ? pkg.agentPrice : pkg.userPrice;
                    return (
                      <button
                        key={pkg._id}
                        onClick={() => setSelectedProductId(pkg._id)}
                        className={`rounded-2xl border-2 p-4 text-left transition-all ${
                          active
                            ? `${net?.border} ${net?.activeBg} shadow-md`
                            : "border-border bg-card hover:border-muted-foreground/30"
                        }`}
                      >
                        <p className={`font-black text-lg ${active ? net?.text : "text-foreground"}`}>{pkg.dataAmount}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 mb-3">{pkg.description}</p>
                        <p className={`text-base font-black ${active ? net?.text : "text-primary"}`}>₵{(pkgPrice || 0).toFixed(2)}</p>
                        {isAgent && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-through">₵{(pkg?.userPrice || 0).toFixed(2)}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No packages available for {net?.label}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 3: Phone + Add to Cart */}
      {selectedProductId && selectedProduct && (!isAgent || user?.isVerified) && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-5">Step 3 — Recipient Details</p>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            {/* Package summary */}
            <div className={`flex-1 rounded-xl p-4 ${net?.bg}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${net?.text} opacity-70 mb-1`}>{net?.label} Data</p>
              <p className={`text-lg font-black ${net?.text}`}>{selectedProduct.name}</p>
              <p className={`text-2xl font-black ${net?.text} mt-1`}>₵{(price || 0).toFixed(2)}</p>
              {isAgent && <p className="text-xs text-muted-foreground mt-0.5">Agent discounted rate</p>}
            </div>

            {/* Phone input */}
            <div className="flex-1 min-w-0">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                Recipient Phone Number
              </label>
              <Input
                placeholder="0244123456 (10 digits)"
                maxLength={10}
                value={phone}
                onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "")); setPhoneError(""); }}
                className="h-11 font-mono tracking-wider mb-1"
              />
              {phoneError && <p className="text-xs text-red-500 font-medium">{phoneError}</p>}
            </div>
          </div>

          <Button
            onClick={handleAddToCart}
            className="w-full mt-5 h-12 font-bold text-base shadow-lg shadow-primary/20 gap-2"
          >
            <ShoppingCart className="h-5 w-5" />
            Add to Cart
          </Button>
        </div>
      )}
    </div>
  );
}

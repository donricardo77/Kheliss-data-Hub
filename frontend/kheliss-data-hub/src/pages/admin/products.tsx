import { useState } from "react";
import type { CreateProductBody, UpdateProductBody } from "@workspace/api-client-react";
import {
  useGetAdminProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, Package, Wifi } from "lucide-react";

const NETWORKS = ["MTN", "Telecel", "AirtelTigo"] as const;
const TYPES = ["data", "airtime"] as const;

type AdminProductForm = {
  name: string;
  network: (typeof NETWORKS)[number];
  type: (typeof TYPES)[number];
  dataAmount: string;
  userPrice: string;
  agentPrice: string;
  description: string;
  vendorProductId: string;
};

export default function AdminProducts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [networkFilter, setNetworkFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const params: any = { limit: 100, page: 1 };
  if (networkFilter !== "all") params.network = networkFilter;
  if (typeFilter !== "all") params.type = typeFilter;

  const { data, isLoading, refetch } = useGetAdminProducts(params, {
    query: { queryKey: ["/api/admin/products", params], retry: 2 },
  });

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  const [formData, setFormData] = useState<AdminProductForm>({
    name: "",
    network: "MTN",
    type: "data",
    dataAmount: "",
    userPrice: "",
    agentPrice: "",
    description: "",
    vendorProductId: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      network: "MTN",
      type: "data",
      dataAmount: "",
      userPrice: "",
      agentPrice: "",
      description: "",
      vendorProductId: "",
    });
    setEditingProduct(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (product: any) => {
    setFormData({
      name: product.name,
      network: product.network,
      type: product.type,
      dataAmount: product.dataAmount || "",
      userPrice: String(product.userPrice),
      agentPrice: String(product.agentPrice),
      description: product.description || "",
      vendorProductId: product.vendorProductId || "",
    });
    setEditingProduct(product);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    const createPayload: CreateProductBody = {
      name: formData.name,
      network: formData.network,
      type: formData.type,
      dataAmount: formData.dataAmount,
      userPrice: Number(formData.userPrice),
      agentPrice: Number(formData.agentPrice),
      description: formData.description,
      vendorProductId: formData.vendorProductId,
    };

    const updatePayload: UpdateProductBody = {
      name: formData.name,
      network: formData.network,
      type: formData.type,
      dataAmount: formData.dataAmount,
      userPrice: Number(formData.userPrice),
      agentPrice: Number(formData.agentPrice),
      description: formData.description,
      vendorProductId: formData.vendorProductId,
    };

    try {
      if (editingProduct) {
        await updateMutation.mutateAsync({ id: editingProduct.id, data: updatePayload });
        toast({ title: "Product updated!", description: `${formData.name} has been updated.` });
      } else {
        await createMutation.mutateAsync({ data: createPayload });
        toast({ title: "Product created!", description: `${formData.name} has been added.` });
      }
      setIsDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      refetch();
    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err?.response?.data?.error || "Failed to save product", 
        variant: "destructive" 
      });
    }
  };

  const handleDelete = async (product: any) => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    
    try {
      await deleteMutation.mutateAsync(product.id);
      toast({ title: "Product deleted!", description: `${product.name} has been removed.` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      refetch();
    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err?.response?.data?.error || "Failed to delete product", 
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-foreground">Products</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage data and airtime packages</p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <Select value={networkFilter} onValueChange={setNetworkFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Network" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Networks</SelectItem>
            {NETWORKS.map((n) => (
              <SelectItem key={n} value={n}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t === "data" ? "Data" : "Airtime"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : data?.products?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No products found. Add your first product!</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Product</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Network</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Type</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold">User Price</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold">Agent Price</th>
                  <th className="text-right px-4 py-3 text-sm font-semibold">Actions</th>
                </tr>
              </thead>
            <tbody className="divide-y divide-border">
              {data?.products?.map((product: any) => (
                <tr key={product.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{product.name}</div>
                    {product.dataAmount && (
                      <div className="text-xs text-muted-foreground">{product.dataAmount}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                      product.network === "MTN" ? "bg-yellow-100 text-yellow-800" :
                      product.network === "Telecel" ? "bg-red-100 text-red-800" :
                      "bg-blue-100 text-blue-800"
                    }`}>
                      <Wifi className="h-3 w-3" />
                      {product.network}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize text-sm">{product.type}</td>
                  <td className="px-4 py-3 text-right font-medium">₵{product.userPrice}</td>
                  <td className="px-4 py-3 text-right font-medium">₵{product.agentPrice}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(product)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground mt-4">
        Total: {data?.total || 0} products
      </p>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Product Name</label>
              <Input 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., MTN 1GB"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Network</label>
                <Select value={formData.network} onValueChange={(v) => setFormData({ ...formData, network: v as AdminProductForm["network"] })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NETWORKS.map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as AdminProductForm["type"] })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="data">Data</SelectItem>
                    <SelectItem value="airtime">Airtime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Data Amount (for data bundles)</label>
              <Input 
                value={formData.dataAmount} 
                onChange={(e) => setFormData({ ...formData, dataAmount: e.target.value })}
                placeholder="e.g., 1GB, 500MB"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">User Price (₵)</label>
                <Input 
                  type="number"
                  value={formData.userPrice} 
                  onChange={(e) => setFormData({ ...formData, userPrice: e.target.value })}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Agent Price (₵)</label>
                <Input 
                  type="number"
                  value={formData.agentPrice} 
                  onChange={(e) => setFormData({ ...formData, agentPrice: e.target.value })}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Input 
                value={formData.description} 
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Vendor Product ID (optional)</label>
              <Input 
                value={formData.vendorProductId} 
                onChange={(e) => setFormData({ ...formData, vendorProductId: e.target.value })}
                placeholder="For vendor integration"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.name || !formData.userPrice || !formData.agentPrice || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingProduct ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
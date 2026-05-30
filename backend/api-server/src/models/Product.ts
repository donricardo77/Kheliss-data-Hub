import { mongoose } from "../lib/mongodb";

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  network: { type: String, enum: ["MTN", "Telecel", "AirtelTigo"], required: true, index: true },
  type: { type: String, enum: ["airtime", "data"], default: "data", required: true },
  dataAmount: { type: String, required: true },
  price: { type: Number, default: 0 },
  userPrice: { type: Number, required: true },
  agentPrice: { type: Number, required: true },
  description: { type: String, required: true },
  vendorProductId: { type: String }, // Mapping to vendor product ID
  vendor: { type: String, enum: ["portal02", "allendatahub"], default: "allendatahub" },
  productValue: { type: String }, // e.g., "1GB", "2GB"
}, { timestamps: true, collection: "products" });

// Index for efficient querying by type (network is already indexed via inline index: true)
ProductSchema.index({ type: 1 });

export interface IProduct {
  _id: mongoose.Types.ObjectId;
  name: string;
  network: "MTN" | "Telecel" | "AirtelTigo";
  type: "airtime" | "data";
  dataAmount: string;
  price: number;
  userPrice: number;
  agentPrice: number;
  description: string;
  vendorProductId?: string;
  vendor?: "portal02" | "allendatahub";
  productValue?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const Product = mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);

import { mongoose } from "../lib/mongodb";

const OrderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  username: { type: String, required: true },
  productId: { type: String },
  network: { type: String, enum: ["MTN", "Telecel", "AirtelTigo"], required: true },
  type: { type: String, enum: ["airtime", "data"], required: true },
  productName: { type: String, required: true },
  recipientPhone: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending" },
  paymentMethod: { type: String, enum: ["paystack", "wallet", "vendor_wallet"], required: true },
  paymentReference: { type: String },
  
  // Timestamps
  placedAt: { type: Date, default: Date.now }, // When the order was placed by user
  
  // Idempotency support - prevents duplicate orders on retries
  idempotencyKey: { type: String, index: true },
  
  // Vendor integration fields
  vendorOrderId: { type: String, index: true },
  vendorReference: { type: String, index: true }, // Reference returned by vendor
  vendorWebhookUrl: { type: String },
  vendorProductId: { type: String },
  vendorPhoneNumber: { type: String },
  vendorStatus: { type: String, enum: ["pending", "processing", "completed", "failed"] },
  webhookHistory: [{ // Track all webhook updates
    status: String,
    timestamp: { type: Date, default: Date.now },
    rawPayload: mongoose.Schema.Types.Mixed,
  }],
}, { timestamps: true });

export interface IOrder {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  username: string;
  productId?: string;
  network: "MTN" | "Telecel" | "AirtelTigo";
  type: "airtime" | "data";
  productName: string;
  recipientPhone: string;
  amount: number;
  status: "pending" | "processing" | "completed" | "failed";
  paymentMethod: "paystack" | "wallet" | "vendor_wallet";
  paymentReference?: string;
  placedAt: Date;
  idempotencyKey?: string;
  vendorOrderId?: string;
  vendorReference?: string; // Reference returned by vendor
  vendorWebhookUrl?: string;
  vendorProductId?: string;
  vendorPhoneNumber?: string;
  vendorStatus?: "pending" | "processing" | "completed" | "failed";
  webhookHistory?: Array<{
    status: string;
    timestamp: Date;
    rawPayload?: Record<string, any>;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export const Order = mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ Error: MONGODB_URI environment variable not set");
  console.log("   Please set your MongoDB connection string:");
  console.log("   export MONGODB_URI='mongodb://...'");
  process.exit(1);
}

// Define Order schema inline
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
  clientOrderReference: { type: String, index: true },
  placedAt: { type: Date, default: Date.now },
  idempotencyKey: { type: String, index: true },
  vendorOrderId: { type: String, index: true },
  vendorReference: { type: String, index: true },
  vendorWebhookUrl: { type: String },
  vendorProductId: { type: String },
  vendorPhoneNumber: { type: String },
  vendorStatus: { type: String, enum: ["pending", "processing", "completed", "failed"] },
  webhookHistory: [{ 
    status: String,
    timestamp: { type: Date, default: Date.now },
    rawPayload: mongoose.Schema.Types.Mixed,
  }],
}, { timestamps: true });

const Order = mongoose.model("Order", OrderSchema);

async function diagnose() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✓ Connected to MongoDB\n");

    // Orders from the webhook logs you provided
    const webhookOrders = [
      {
        orderId: "6a1ae5e42dc2e9f8d27f99b5",
        reference: "API-698452b0abc0a320e49dffcc-1780147684388-7200e9f97a5c7",
        status: "completed",
      },
      {
        orderId: "6a1ae6e52dc2e9f8d27f99c2",
        reference: "API-698452b0abc0a320e49dffcc-1780147941537-70d01a79328da",
        status: "completed",
      },
      {
        orderId: "6a1ae6f72dc2e9f8d27f99cf",
        reference: "API-698452b0abc0a320e49dffcc-1780147959153-c51d225da0849",
        status: "completed",
      },
    ];

    console.log("📋 Searching for webhook orders...\n");

    for (const webhook of webhookOrders) {
      console.log(`\n🔍 Order: ${webhook.orderId}`);
      console.log(`   Reference: ${webhook.reference}`);
      console.log(`   Expected Status: ${webhook.status}`);

      // Try all lookup strategies
      const strategies = [
        { field: "_id", query: { _id: webhook.orderId } },
        { field: "_id (ObjectId)", query: { _id: new mongoose.Types.ObjectId(webhook.orderId) } },
        { field: "vendorOrderId", query: { vendorOrderId: webhook.orderId } },
        { field: "vendorReference", query: { vendorReference: webhook.reference } },
        { field: "clientOrderReference", query: { clientOrderReference: webhook.reference } },
        { field: "paymentReference", query: { paymentReference: webhook.reference } },
      ];

      let found = false;
      for (const { field, query } of strategies) {
        try {
          const order = await Order.findOne(query);
          if (order) {
            console.log(`   ✓ FOUND via ${field}`);
            console.log(`     - _id: ${order._id}`);
            console.log(`     - vendorOrderId: ${order.vendorOrderId}`);
            console.log(`     - vendorReference: ${order.vendorReference}`);
            console.log(`     - clientOrderReference: ${order.clientOrderReference}`);
            console.log(`     - Current Status: ${order.status}`);
            console.log(`     - Current VendorStatus: ${order.vendorStatus}`);
            console.log(`     - Webhook History Length: ${order.webhookHistory?.length || 0}`);
            found = true;
            break;
          }
        } catch (err) {
          // Skip on error (e.g., invalid ObjectId)
        }
      }

      if (!found) {
        console.log(`   ✗ NOT FOUND using any lookup strategy`);
      }
    }

    // Additional diagnostics
    console.log("\n\n📊 Database Statistics:");
    const totalOrders = await Order.countDocuments();
    const processingOrders = await Order.countDocuments({ status: "processing" });
    const completedOrders = await Order.countDocuments({ status: "completed" });
    const failedOrders = await Order.countDocuments({ status: "failed" });
    const pendingOrders = await Order.countDocuments({ status: "pending" });

    console.log(`   Total Orders: ${totalOrders}`);
    console.log(`   - Pending: ${pendingOrders}`);
    console.log(`   - Processing: ${processingOrders}`);
    console.log(`   - Completed: ${completedOrders}`);
    console.log(`   - Failed: ${failedOrders}`);

    // Show recent orders with processing status
    if (processingOrders > 0) {
      console.log("\n📌 Recent Orders with 'processing' status:");
      const recentProcessing = await Order.find({ status: "processing" })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("_id vendorOrderId vendorReference clientOrderReference status vendorStatus createdAt updatedAt");
      
      for (const order of recentProcessing) {
        console.log(`   - ${order._id}: vendorOrderId=${order.vendorOrderId}, ref=${order.vendorReference}, status=${order.status}`);
      }
    }

    await mongoose.connection.close();
    console.log("\n✓ Disconnected from MongoDB");

  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

diagnose();

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ Error: MONGODB_URI environment variable not set");
  process.exit(1);
}

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

async function migrateVendorFields() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✓ Connected to MongoDB\n");

    // Find orders with undefined vendorStatus or webhookHistory
    console.log("🔍 Searching for orders that need migration...\n");

    const ordersNeedingMigration = await Order.find({
      $or: [
        { vendorStatus: { $exists: false } },
        { vendorStatus: null },
        { webhookHistory: { $exists: true, $ne: [] } }
      ]
    });

    console.log(`Found ${ordersNeedingMigration.length} orders to update\n`);

    let updated = 0;
    let skipped = 0;

    for (const order of ordersNeedingMigration) {
      // Extract the latest webhook status
      let newVendorStatus = order.vendorStatus;
      
      if (order.webhookHistory && order.webhookHistory.length > 0) {
        const latestWebhook = order.webhookHistory[order.webhookHistory.length - 1];
        const webhookStatus = latestWebhook.status?.toLowerCase() || "pending";
        
        // Map webhook status to vendorStatus
        if (["completed", "delivered", "success", "resolved"].includes(webhookStatus)) {
          newVendorStatus = "completed";
        } else if (["failed", "cancelled", "refunded"].includes(webhookStatus)) {
          newVendorStatus = "failed";
        } else if (["processing", "pending"].includes(webhookStatus)) {
          newVendorStatus = webhookStatus;
        }

        // Only update if needed
        if (!order.vendorStatus || order.vendorStatus !== newVendorStatus) {
          await Order.updateOne(
            { _id: order._id },
            {
              $set: {
                vendorStatus: newVendorStatus || "pending",
                updatedAt: new Date()
              }
            }
          );
          updated++;
          console.log(`✓ Updated order ${order._id}: vendorStatus → ${newVendorStatus}`);
        } else {
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    console.log(`\n📊 Migration Results:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);

    // Verify the fix
    console.log(`\n📋 Verifying fix...`);
    const stillUndefined = await Order.countDocuments({ 
      $or: [
        { vendorStatus: { $exists: false } },
        { vendorStatus: null }
      ]
    });

    if (stillUndefined === 0) {
      console.log(`✅ All orders now have vendorStatus field set!`);
    } else {
      console.log(`⚠️  Still ${stillUndefined} orders with undefined vendorStatus`);
    }

    await mongoose.connection.close();
    console.log("\n✓ Disconnected from MongoDB");

  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

migrateVendorFields();

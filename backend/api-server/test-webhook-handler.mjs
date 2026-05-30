import mongoose from "mongoose";
import fetch from "node-fetch";

const MONGODB_URI = process.env.MONGODB_URI;
const API_BASE_URL = process.env.BACKEND_URL || "http://localhost:3001";
const WEBHOOK_URL = `${API_BASE_URL}/api/vendor/allen-datahub/webhook`;

if (!MONGODB_URI) {
  console.error("❌ Error: MONGODB_URI not set");
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

async function testWebhook() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✓ Connected to MongoDB\n");

    // 1. Create a test order
    console.log("📝 Step 1: Creating test order...");
    const testOrder = new Order({
      userId: new mongoose.Types.ObjectId(),
      username: "test_webhook_user",
      network: "MTN",
      type: "airtime",
      productName: "Test Airtime",
      recipientPhone: "+233501234567",
      amount: 1000,
      paymentMethod: "wallet",
      clientOrderReference: `TEST-WEBHOOK-${Date.now()}`,
      vendorOrderId: `TEST-${Date.now()}`,
      status: "processing",
      vendorStatus: "processing",
    });

    await testOrder.save();
    console.log(`✓ Created order: ${testOrder._id}`);
    console.log(`  - Initial status: ${testOrder.status}`);
    console.log(`  - Initial vendorStatus: ${testOrder.vendorStatus}`);
    console.log(`  - vendorOrderId: ${testOrder.vendorOrderId}\n`);

    // 2. Create webhook payload
    console.log("📤 Step 2: Sending webhook payload...");
    const webhookPayload = {
      event: "order.status.updated",
      data: {
        orderId: testOrder.vendorOrderId,
        reference: testOrder.clientOrderReference,
        status: "completed",
        timestamp: new Date().toISOString(),
      }
    };

    console.log(`  Payload:`, JSON.stringify(webhookPayload, null, 2));

    // 3. Send webhook
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhookPayload)
      });

      const responseData = await response.json();
      console.log(`  Response Status: ${response.status}`);
      console.log(`  Response:`, JSON.stringify(responseData, null, 2));
    } catch (fetchErr) {
      console.log(`⚠️  Webhook endpoint not accessible: ${fetchErr.message}`);
      console.log(`  This is expected if API server isn't running.\n`);
    }

    // 4. Check if order was updated
    console.log("\n🔍 Step 3: Checking if order was updated...");
    
    // Wait a moment for any async processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    const updatedOrder = await Order.findById(testOrder._id);
    console.log(`  Current status: ${updatedOrder.status}`);
    console.log(`  Current vendorStatus: ${updatedOrder.vendorStatus}`);
    console.log(`  Webhook History Length: ${updatedOrder.webhookHistory?.length || 0}`);

    if (updatedOrder.webhookHistory && updatedOrder.webhookHistory.length > 0) {
      console.log(`  Latest webhook event: ${updatedOrder.webhookHistory[updatedOrder.webhookHistory.length - 1].status}`);
    }

    // 5. Verify update
    console.log("\n📊 Test Results:");
    if (updatedOrder.status === "completed" && updatedOrder.vendorStatus === "completed") {
      console.log(`  ✅ WEBHOOK WORKS! Order status updated to completed`);
    } else if (updatedOrder.webhookHistory && updatedOrder.webhookHistory.length > 0) {
      console.log(`  ⚠️  Webhook received but status not updated`);
      console.log(`     Status: ${updatedOrder.status} (expected: completed)`);
      console.log(`     VendorStatus: ${updatedOrder.vendorStatus} (expected: completed)`);
    } else {
      console.log(`  ❌ WEBHOOK FAILED! No webhook history recorded`);
      console.log(`     Possible causes:`);
      console.log(`     1. Order not found by lookup strategy`);
      console.log(`     2. Webhook handler has an error`);
      console.log(`     3. API server not running or webhook endpoint not accessible`);
    }

    // 6. Clean up
    console.log("\n🧹 Cleaning up test order...");
    await Order.deleteOne({ _id: testOrder._id });
    console.log("✓ Test order deleted");

    await mongoose.connection.close();

  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

testWebhook();

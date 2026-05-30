import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ Error: MONGODB_URI not set");
  process.exit(1);
}

const OrderSchema = new mongoose.Schema({
  vendorStatus: { type: String, enum: ["pending", "processing", "completed", "failed"] },
  status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending" },
}, { timestamps: true });

const Order = mongoose.model("Order", OrderSchema);

async function fixRemaining() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✓ Connected to MongoDB\n");

    // Fix remaining 34 orders without vendorStatus
    const result = await Order.updateMany(
      { $or: [{ vendorStatus: { $exists: false } }, { vendorStatus: null }] },
      { $set: { vendorStatus: "pending", updatedAt: new Date() } }
    );

    console.log(`✅ Fixed remaining ${result.modifiedCount} orders → vendorStatus = "pending"`);

    // Verify
    const verify = await Order.countDocuments({ 
      $or: [{ vendorStatus: { $exists: false } }, { vendorStatus: null }] 
    });

    console.log(`\n📊 Final Verification:`);
    if (verify === 0) {
      console.log(`   ✅ All orders now have vendorStatus field set!`);
    } else {
      console.log(`   ⚠️  Still ${verify} orders without vendorStatus`);
    }

    // Show final stats
    const stats = await Order.aggregate([
      { $group: { _id: "$vendorStatus", count: { $sum: 1 } } }
    ]);

    console.log(`\n📈 Final Distribution:`);
    for (const stat of stats) {
      console.log(`   ${stat._id}: ${stat.count} orders`);
    }

    await mongoose.connection.close();
    console.log("\n✓ Disconnected from MongoDB");

  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

fixRemaining();

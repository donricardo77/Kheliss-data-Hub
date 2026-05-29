import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;
if (!uri) {
  console.error('MONGODB_URI or DATABASE_URL must be set in environment to run migration.');
  process.exit(1);
}

async function run() {
  await mongoose.connect(uri, { dbName: undefined });
  const db = mongoose.connection.db;
  console.log('Connected to MongoDB, running migration...');

  const col = db.collection('orders');

  // Fix 'venderorderid' -> 'vendorOrderId'
  const cursor1 = col.find({ venderorderid: { $exists: true } });
  let count1 = 0;
  while (await cursor1.hasNext()) {
    const doc = await cursor1.next();
    const update: any = {};
    if (doc.venderorderid) update.vendorOrderId = doc.venderorderid;
    if (doc.vendorreference) update.vendorReference = doc.vendorreference;
    if (Object.keys(update).length > 0) {
      await col.updateOne({ _id: doc._id }, { $set: update, $unset: { venderorderid: '', vendorreference: '' } });
      count1++;
    }
  }

  // Also fix documents that have lowercase 'vendorreference' only
  const cursor2 = col.find({ vendorreference: { $exists: true } });
  let count2 = 0;
  while (await cursor2.hasNext()) {
    const doc = await cursor2.next();
    if (doc.vendorreference && !doc.vendorReference) {
      await col.updateOne({ _id: doc._id }, { $set: { vendorReference: doc.vendorreference }, $unset: { vendorreference: '' } });
      count2++;
    }
  }

  console.log(`Migration complete. Updated ${count1} docs (venderorderid/vendorreference) and ${count2} docs (vendorreference).`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed', err);
  process.exit(1);
});

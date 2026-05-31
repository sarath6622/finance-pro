// P10 backfill: add version=0 and bookedAt=<createdAt|now> to every sync-eligible row.
// Idempotent and safe to re-run.

import mongoose from "mongoose";

const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/finance-tracker";

const COLLECTIONS = [
  "transactions",
  "accounts",
  "receivables",
  "split_bills",
  "holdings",
  "budgets",
  "recurring_rules",
  "counterparties",
  "categories",
  "settings",
];

await mongoose.connect(uri);
const db = mongoose.connection.db;

for (const name of COLLECTIONS) {
  const coll = db.collection(name);

  const versionRes = await coll.updateMany(
    { version: { $exists: false } },
    { $set: { version: 0 } },
  );

  // bookedAt: copy createdAt where missing; if no createdAt, set to current time.
  const docs = await coll.find({ bookedAt: { $exists: false } }, { projection: { _id: 1, createdAt: 1 } }).toArray();
  let bookedAtSet = 0;
  for (const doc of docs) {
    const bookedAt = doc.createdAt instanceof Date ? doc.createdAt : new Date();
    await coll.updateOne({ _id: doc._id }, { $set: { bookedAt } });
    bookedAtSet += 1;
  }

  console.log(
    `  ${name.padEnd(18)} version+=${versionRes.modifiedCount}  bookedAt+=${bookedAtSet}`,
  );
}

await mongoose.disconnect();
console.log("p10 backfill complete.");

import mongoose from "mongoose";
const uri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/finance-tracker";
await mongoose.connect(uri);
const Account = mongoose.connection.collection("accounts");
await Account.updateOne(
  { name: "Jumbo Loan" },
  { $set: { openingBalancePaise: 50000000, interestRatePA: 12, tenureMonths: 36, emiAmountPaise: 1660000 } },
);
await Account.updateOne(
  { name: "Personal Loan 8012" },
  { $set: { openingBalancePaise: 20000000, interestRatePA: 18, tenureMonths: 24, emiAmountPaise: 998000 } },
);
console.log("Loans seeded:");
for (const a of await Account.find({ kind: "loan" }).toArray()) {
  console.log(" -", a.name, "open:", a.openingBalancePaise, "rate:", a.interestRatePA, "tenure:", a.tenureMonths, "emi:", a.emiAmountPaise);
}
await mongoose.disconnect();

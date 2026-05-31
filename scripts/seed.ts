/**
 * Seed accounts, counterparties, categories, and the singleton setting.
 * Idempotent — safe to run repeatedly.
 *
 * Usage: npm run seed
 * Requires MONGODB_URI in .env.local.
 */
import { connectMongo, disconnectMongo } from "../lib/db/mongo";
import {
  AccountModel,
  CounterpartyModel,
  CategoryModel,
  SettingModel,
} from "../models";

type AccountSeed = {
  name: string;
  kind: "bank" | "credit_card" | "cash" | "investment" | "loan" | "wallet";
  classification: "asset" | "liability";
  institution?: string;
  last4Label?: string;
};

const accounts: AccountSeed[] = [
  { name: "HDFC Bank", kind: "bank", classification: "asset", institution: "HDFC" },
  { name: "HDFC Card", kind: "credit_card", classification: "liability", institution: "HDFC" },
  { name: "Kotak Card", kind: "credit_card", classification: "liability", institution: "Kotak" },
  { name: "Axis Card", kind: "credit_card", classification: "liability", institution: "Axis" },
  { name: "Cash", kind: "cash", classification: "asset" },
  {
    name: "INDmoney",
    kind: "investment",
    classification: "asset",
    institution: "INDmoney",
  },
  { name: "Jumbo Loan", kind: "loan", classification: "liability" },
  {
    name: "Personal Loan 8012",
    kind: "loan",
    classification: "liability",
    last4Label: "8012",
  },
];

type CounterpartySeed = {
  displayName: string;
  type: "family" | "roommate" | "friend" | "merchant" | "employer" | "self" | "institution";
  aliases?: string[];
};

const counterparties: CounterpartySeed[] = [
  { displayName: "Dad", type: "family", aliases: ["CHANDAN KT"] },
  { displayName: "Devanand", type: "roommate" },
  { displayName: "Sarathchandran", type: "roommate" },
  { displayName: "Augustine", type: "roommate" },
  { displayName: "Self", type: "self" },
  { displayName: "HDFC Bank", type: "institution", aliases: ["HDFC", "HDFC LTD"] },
  { displayName: "Kotak", type: "institution", aliases: ["KOTAK"] },
  { displayName: "Axis Bank", type: "institution", aliases: ["AXIS"] },
];

type CategorySeed = {
  name: string;
  slug: string;
  defaultFlowType?:
    | "spend"
    | "income"
    | "family_support"
    | "investment"
    | "debt_repayment"
    | "lending_out"
    | "lending_repaid"
    | "reimbursement_in"
    | "card_settlement"
    | "transfer"
    | "fee";
};

const categories: CategorySeed[] = [
  // Spend categories
  { name: "Dining & Eating Out", slug: "dining", defaultFlowType: "spend" },
  { name: "Daily Tea/Snacks", slug: "daily-tea", defaultFlowType: "spend" },
  { name: "Groceries", slug: "groceries", defaultFlowType: "spend" },
  { name: "Fuel", slug: "fuel", defaultFlowType: "spend" },
  { name: "Subscriptions", slug: "subscriptions", defaultFlowType: "spend" },
  { name: "Telecom", slug: "telecom", defaultFlowType: "spend" },
  { name: "Insurance", slug: "insurance", defaultFlowType: "spend" },
  { name: "Household & Shopping", slug: "household", defaultFlowType: "spend" },
  { name: "Entertainment / Outings", slug: "entertainment", defaultFlowType: "spend" },
  { name: "Misc / People", slug: "misc-people", defaultFlowType: "spend" },
  { name: "Fees & Charges", slug: "fees", defaultFlowType: "fee" },
  // Non-spend categories
  { name: "Family Support (Dad)", slug: "family-support-dad", defaultFlowType: "family_support" },
  { name: "Investment — SIP/MF", slug: "inv-sip-mf", defaultFlowType: "investment" },
  { name: "Investment — Stocks", slug: "inv-stocks", defaultFlowType: "investment" },
  { name: "Investment — Crypto", slug: "inv-crypto", defaultFlowType: "investment" },
  {
    name: "Credit Card Payment",
    slug: "credit-card-payment",
    defaultFlowType: "card_settlement",
  },
  { name: "Loan / Card EMI", slug: "emi", defaultFlowType: "debt_repayment" },
  { name: "Lending (cash loan)", slug: "lending", defaultFlowType: "lending_out" },
  { name: "Split IOU (owed to me)", slug: "split-iou", defaultFlowType: "reimbursement_in" },
  { name: "Salary", slug: "salary", defaultFlowType: "income" },
  { name: "Dividend / Interest", slug: "dividend-interest", defaultFlowType: "income" },
  { name: "Reimbursement / Split", slug: "reimbursement", defaultFlowType: "reimbursement_in" },
  { name: "Self Transfer", slug: "self-transfer", defaultFlowType: "transfer" },
];

async function main() {
  await connectMongo();

  let upAccounts = 0;
  for (const a of accounts) {
    const res = await AccountModel.updateOne(
      { name: a.name },
      { $setOnInsert: { ...a, currency: "INR", openingBalancePaise: 0, isActive: true } },
      { upsert: true },
    );
    if (res.upsertedCount) upAccounts++;
  }

  let upCounterparties = 0;
  for (const c of counterparties) {
    const res = await CounterpartyModel.updateOne(
      { displayName: c.displayName, type: c.type },
      { $setOnInsert: { ...c, aliases: c.aliases ?? [] } },
      { upsert: true },
    );
    if (res.upsertedCount) upCounterparties++;
  }

  let upCategories = 0;
  for (let i = 0; i < categories.length; i++) {
    const c = categories[i]!;
    const res = await CategoryModel.updateOne(
      { slug: c.slug },
      { $setOnInsert: { ...c, sortOrder: i, isActive: true } },
      { upsert: true },
    );
    if (res.upsertedCount) upCategories++;
  }

  await SettingModel.updateOne(
    { key: "default" },
    { $setOnInsert: { key: "default" } },
    { upsert: true },
  );

  console.log(
    `seed: accounts +${upAccounts}/${accounts.length}, counterparties +${upCounterparties}/${counterparties.length}, categories +${upCategories}/${categories.length}`,
  );

  await disconnectMongo();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

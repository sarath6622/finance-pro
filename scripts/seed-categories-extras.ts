/**
 * Additive: extends the baseline category set with more specific buckets
 * (split subscriptions, insurance lines, utilities, travel, etc).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-categories-extras.ts            # dry-run
 *   npx tsx --env-file=.env.local scripts/seed-categories-extras.ts --apply    # write
 *
 * Idempotent — upserts by slug, so re-running is safe and won't create
 * duplicates or overwrite existing categories' names/colors/sortOrder.
 * Existing generic categories like "Subscriptions" and "Insurance" are
 * intentionally left in place as catch-alls.
 */
import { connectMongo, disconnectMongo } from "../lib/db/mongo";
import { CategoryModel } from "../models";

type FlowType =
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

interface CategorySeed {
  name: string;
  slug: string;
  defaultFlowType: FlowType;
}

const EXTRAS: CategorySeed[] = [
  // Subscriptions — split by cadence and type
  { name: "Subscriptions — Monthly", slug: "subscriptions-monthly", defaultFlowType: "spend" },
  { name: "Subscriptions — Yearly", slug: "subscriptions-yearly", defaultFlowType: "spend" },
  { name: "Monthly Streaming (Netflix, Prime, Spotify)", slug: "streaming-monthly", defaultFlowType: "spend" },
  { name: "Yearly Streaming (Netflix, Prime, Spotify)", slug: "streaming-yearly", defaultFlowType: "spend" },
  { name: "Software / AI tools", slug: "software-ai", defaultFlowType: "spend" },
  { name: "Cloud storage (iCloud, Google One)", slug: "cloud-storage", defaultFlowType: "spend" },

  // Insurance — split by line of cover
  { name: "Insurance — Health", slug: "insurance-health", defaultFlowType: "spend" },
  { name: "Insurance — Term Life", slug: "insurance-term-life", defaultFlowType: "spend" },
  { name: "Insurance — Vehicle", slug: "insurance-vehicle", defaultFlowType: "spend" },

  // Utilities — currently missing
  { name: "Electricity", slug: "electricity", defaultFlowType: "spend" },
  { name: "Internet / Broadband", slug: "internet-broadband", defaultFlowType: "spend" },
  { name: "Gas / LPG", slug: "gas-lpg", defaultFlowType: "spend" },
  { name: "Water", slug: "water", defaultFlowType: "spend" },

  // Home
  { name: "Rent", slug: "rent", defaultFlowType: "spend" },
  { name: "Home Maintenance", slug: "home-maintenance", defaultFlowType: "spend" },

  // Healthcare
  { name: "Healthcare / Doctor", slug: "healthcare", defaultFlowType: "spend" },
  { name: "Pharmacy / Medicines", slug: "pharmacy", defaultFlowType: "spend" },

  // Transport
  { name: "Cab / Auto / Rapido", slug: "cab-auto", defaultFlowType: "spend" },
  { name: "Public Transit", slug: "public-transit", defaultFlowType: "spend" },

  // Personal
  { name: "Salon / Grooming", slug: "salon-grooming", defaultFlowType: "spend" },
  { name: "Clothing", slug: "clothing", defaultFlowType: "spend" },
  { name: "Gifts", slug: "gifts", defaultFlowType: "spend" },

  // Travel
  { name: "Travel — Flights", slug: "travel-flights", defaultFlowType: "spend" },
  { name: "Travel — Stay", slug: "travel-stay", defaultFlowType: "spend" },
  { name: "Travel — Local", slug: "travel-local", defaultFlowType: "spend" },

  // Other
  { name: "Education / Books / Courses", slug: "education", defaultFlowType: "spend" },
  { name: "Donations / Charity", slug: "donations", defaultFlowType: "spend" },

  // Non-spend
  { name: "Investment — FD / RD", slug: "inv-fd-rd", defaultFlowType: "investment" },
  { name: "Investment — Gold", slug: "inv-gold", defaultFlowType: "investment" },
];

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  await connectMongo();

  const existing = await CategoryModel.find(
    { slug: { $in: EXTRAS.map((c) => c.slug) } },
    { slug: 1, name: 1 },
  ).lean();
  const existingSlugs = new Set(existing.map((c) => c.slug));

  const totalInDb = await CategoryModel.countDocuments({});
  console.log(`\nCurrent category count in DB: ${totalInDb}`);
  console.log(`Extras script defines: ${EXTRAS.length} categories\n`);

  const toCreate = EXTRAS.filter((c) => !existingSlugs.has(c.slug));
  const alreadyThere = EXTRAS.filter((c) => existingSlugs.has(c.slug));

  if (alreadyThere.length > 0) {
    console.log(`Already in DB (will be left untouched): ${alreadyThere.length}`);
    for (const c of alreadyThere) console.log(`  · ${c.slug.padEnd(28)}  ${c.name}`);
    console.log();
  }

  if (toCreate.length === 0) {
    console.log("Nothing to add — all extras already exist.");
    await disconnectMongo();
    return;
  }

  console.log(`To create: ${toCreate.length}`);
  console.log("─".repeat(78));
  for (const c of toCreate) {
    console.log(`  + ${c.slug.padEnd(28)}  ${c.name.padEnd(40)}  [${c.defaultFlowType}]`);
  }
  console.log("─".repeat(78));

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to write.");
    await disconnectMongo();
    return;
  }

  console.log("\nApplying…");
  // Place new extras after existing categories in sortOrder.
  const maxSort = await CategoryModel.findOne({}, { sortOrder: 1 })
    .sort({ sortOrder: -1 })
    .lean();
  const baseSort = (maxSort?.sortOrder ?? 0) + 1;
  let created = 0;
  for (let i = 0; i < toCreate.length; i++) {
    const c = toCreate[i]!;
    const res = await CategoryModel.updateOne(
      { slug: c.slug },
      {
        $setOnInsert: {
          name: c.name,
          slug: c.slug,
          defaultFlowType: c.defaultFlowType,
          sortOrder: baseSort + i,
          isActive: true,
        },
      },
      { upsert: true },
    );
    if (res.upsertedCount) {
      created++;
      console.log(`  ✓ ${c.slug}`);
    }
  }
  console.log(`\nDone. Created ${created} / skipped ${toCreate.length - created}.`);

  await disconnectMongo();
}

main().catch((err) => {
  console.error(err);
  disconnectMongo().finally(() => process.exit(1));
});

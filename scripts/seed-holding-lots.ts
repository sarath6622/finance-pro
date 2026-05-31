/**
 * One-off: backfill SIP buy lots into a specific holding.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-holding-lots.ts --holding <id>           # dry-run
 *   npx tsx --env-file=.env.local scripts/seed-holding-lots.ts --holding <id> --apply   # write
 *
 * Each row produces one FIFO lot via importLot() — no offsetting bank
 * Transaction. Unit cost is derived from ₹ invested ÷ units so the cost
 * basis lands within ~₹1 of the SIP amount.
 *
 * NOT idempotent. Running --apply twice creates duplicate lots. Verify
 * the dry-run output before passing --apply.
 *
 * To add a new fund: append a new entry to SIP_SETS below, then run with
 * the matching --holding id.
 */
import { connectMongo, disconnectMongo } from "../lib/db/mongo";
import { HoldingModel } from "../models";
import { importLot } from "../lib/holdings/lifecycle";

interface SipRow {
  date: string;
  units: number;
  amountRupees: number;
}

const SIP_SETS: Record<string, SipRow[]> = {
  // JM Aggressive Hybrid Fund on INDmoney
  "6a1c8545fb51934f7ed62c90": [
    { date: "2025-11-06", units: 21.496, amountRupees: 3000 },
    { date: "2025-12-09", units: 21.968, amountRupees: 3000 },
    { date: "2026-01-08", units: 21.656, amountRupees: 3000 },
    { date: "2026-02-10", units: 21.843, amountRupees: 3000 },
    { date: "2026-03-10", units: 23.275, amountRupees: 3000 },
    { date: "2026-04-08", units: 23.862, amountRupees: 3000 },
    { date: "2026-05-08", units: 22.176, amountRupees: 3000 },
  ],
  // HDFC Flexi Cap Fund on INDmoney
  "6a1c877eb59aeffe8266970d": [
    { date: "2025-11-06", units: 0.891, amountRupees: 2000 },
    { date: "2025-12-09", units: 0.884, amountRupees: 2000 },
    { date: "2026-01-07", units: 0.868, amountRupees: 2000 },
    { date: "2026-02-07", units: 0.882, amountRupees: 2000 },
    { date: "2026-03-07", units: 0.917, amountRupees: 2000 },
    { date: "2026-04-07", units: 0.973, amountRupees: 2000 },
    { date: "2026-05-08", units: 0.917, amountRupees: 2000 },
  ],
  // Nippon India Nifty Smallcap 250 Index Fund Dir Gr on INDmoney — daily SIP
  "6a1c8813b59aeffe8266971c": [
    { date: "2025-11-13", units: 2.949, amountRupees: 100 },
    { date: "2025-11-18", units: 2.935, amountRupees: 100 },
    { date: "2025-11-19", units: 2.966, amountRupees: 100 },
    { date: "2025-11-19", units: 2.978, amountRupees: 100 },
    { date: "2025-11-20", units: 2.981, amountRupees: 100 },
    { date: "2025-11-21", units: 3.018, amountRupees: 100 },
    { date: "2025-11-25", units: 3.038, amountRupees: 100 },
    { date: "2025-11-28", units: 3.01, amountRupees: 100 },
    { date: "2025-11-29", units: 3.017, amountRupees: 100 },
    { date: "2025-12-02", units: 3.01, amountRupees: 100 },
    { date: "2025-12-03", units: 3.023, amountRupees: 100 },
    { date: "2025-12-03", units: 3.037, amountRupees: 100 },
    { date: "2025-12-06", units: 3.06, amountRupees: 100 },
    { date: "2025-12-09", units: 3.1, amountRupees: 100 },
    { date: "2025-12-09", units: 3.132, amountRupees: 100 },
    { date: "2025-12-11", units: 3.122, amountRupees: 100 },
    { date: "2025-12-12", units: 3.105, amountRupees: 100 },
    { date: "2025-12-13", units: 3.079, amountRupees: 100 },
    { date: "2025-12-16", units: 3.068, amountRupees: 100 },
    { date: "2025-12-17", units: 3.092, amountRupees: 100 },
    { date: "2025-12-18", units: 3.114, amountRupees: 100 },
    { date: "2025-12-19", units: 3.077, amountRupees: 100 },
    { date: "2025-12-19", units: 3.118, amountRupees: 100 },
    { date: "2025-12-23", units: 3.048, amountRupees: 100 },
    { date: "2025-12-24", units: 3.035, amountRupees: 100 },
    { date: "2025-12-25", units: 3.033, amountRupees: 100 },
    { date: "2025-12-27", units: 3.039, amountRupees: 100 },
    { date: "2025-12-30", units: 3.055, amountRupees: 100 },
    { date: "2025-12-31", units: 3.062, amountRupees: 100 },
    { date: "2026-01-02", units: 3.029, amountRupees: 100 },
    { date: "2026-01-03", units: 3.006, amountRupees: 100 },
    { date: "2026-01-06", units: 2.998, amountRupees: 100 },
    { date: "2026-01-07", units: 3.007, amountRupees: 100 },
    { date: "2026-01-08", units: 3.003, amountRupees: 100 },
    { date: "2026-01-09", units: 3.062, amountRupees: 100 },
    { date: "2026-01-10", units: 3.115, amountRupees: 100 },
    { date: "2026-01-13", units: 3.116, amountRupees: 100 },
    { date: "2026-01-13", units: 3.136, amountRupees: 100 },
    { date: "2026-01-15", units: 3.101, amountRupees: 100 },
    { date: "2026-01-16", units: 3.115, amountRupees: 100 },
    { date: "2026-01-20", units: 3.151, amountRupees: 100 },
    { date: "2026-01-21", units: 3.238, amountRupees: 100 },
    { date: "2026-01-21", units: 3.262, amountRupees: 100 },
    { date: "2026-01-22", units: 3.233, amountRupees: 100 },
    { date: "2026-01-24", units: 3.297, amountRupees: 100 },
    { date: "2026-01-28", units: 3.29, amountRupees: 100 },
    { date: "2026-01-29", units: 3.228, amountRupees: 100 },
    { date: "2026-01-30", units: 3.203, amountRupees: 100 },
    { date: "2026-01-30", units: 3.23, amountRupees: 100 },
    { date: "2026-02-02", units: 3.256, amountRupees: 100 },
    { date: "2026-02-04", units: 3.163, amountRupees: 100 },
    { date: "2026-02-05", units: 3.139, amountRupees: 100 },
    { date: "2026-02-06", units: 3.171, amountRupees: 100 },
    { date: "2026-02-07", units: 3.182, amountRupees: 100 },
    { date: "2026-02-10", units: 3.103, amountRupees: 100 },
    { date: "2026-02-11", units: 3.087, amountRupees: 100 },
    { date: "2026-02-12", units: 3.084, amountRupees: 100 },
    { date: "2026-02-13", units: 3.106, amountRupees: 100 },
    { date: "2026-02-14", units: 3.157, amountRupees: 100 },
    { date: "2026-02-17", units: 3.158, amountRupees: 100 },
    { date: "2026-02-18", units: 3.135, amountRupees: 100 },
    { date: "2026-02-19", units: 3.119, amountRupees: 100 },
    { date: "2026-02-27", units: 3.178, amountRupees: 100 },
    { date: "2026-03-05", units: 3.309, amountRupees: 100 },
    { date: "2026-03-05", units: 3.309, amountRupees: 100 },
    { date: "2026-03-06", units: 3.263, amountRupees: 100 },
    { date: "2026-03-07", units: 3.272, amountRupees: 100 },
    { date: "2026-03-10", units: 3.35, amountRupees: 100 },
    { date: "2026-03-11", units: 3.28, amountRupees: 100 },
    { date: "2026-03-12", units: 3.293, amountRupees: 100 },
    { date: "2026-03-13", units: 3.306, amountRupees: 100 },
    { date: "2026-03-14", units: 3.397, amountRupees: 100 },
    { date: "2026-03-17", units: 3.409, amountRupees: 100 },
    { date: "2026-03-18", units: 3.331, amountRupees: 100 },
    { date: "2026-03-18", units: 3.39, amountRupees: 100 },
    { date: "2026-03-20", units: 3.412, amountRupees: 100 },
    { date: "2026-03-20", units: 3.421, amountRupees: 100 },
    { date: "2026-03-24", units: 3.463, amountRupees: 100 },
    { date: "2026-03-26", units: 3.379, amountRupees: 100 },
    { date: "2026-03-27", units: 3.445, amountRupees: 100 },
    { date: "2026-03-31", units: 3.534, amountRupees: 100 },
    { date: "2026-04-02", units: 3.424, amountRupees: 100 },
    { date: "2026-04-03", units: 3.43, amountRupees: 100 },
    { date: "2026-04-07", units: 3.394, amountRupees: 100 },
    { date: "2026-04-08", units: 3.262, amountRupees: 100 },
    { date: "2026-04-08", units: 3.389, amountRupees: 100 },
    { date: "2026-04-10", units: 3.206, amountRupees: 100 },
    { date: "2026-04-10", units: 3.258, amountRupees: 100 },
    { date: "2026-04-14", units: 3.219, amountRupees: 100 },
    { date: "2026-04-15", units: 3.147, amountRupees: 100 },
    { date: "2026-04-17", units: 3.118, amountRupees: 100 },
    { date: "2026-04-18", units: 3.072, amountRupees: 100 },
    { date: "2026-04-21", units: 3.084, amountRupees: 100 },
    { date: "2026-04-22", units: 3.059, amountRupees: 100 },
    { date: "2026-04-23", units: 3.028, amountRupees: 100 },
    { date: "2026-04-24", units: 3.044, amountRupees: 100 },
    { date: "2026-04-25", units: 3.077, amountRupees: 100 },
    { date: "2026-04-28", units: 3.022, amountRupees: 100 },
    { date: "2026-04-29", units: 3.021, amountRupees: 100 },
    { date: "2026-04-30", units: 3.006, amountRupees: 100 },
    { date: "2026-04-30", units: 3.019, amountRupees: 100 },
    { date: "2026-05-05", units: 2.99, amountRupees: 100 },
    { date: "2026-05-06", units: 2.931, amountRupees: 100 },
    { date: "2026-05-06", units: 2.984, amountRupees: 100 },
    { date: "2026-05-07", units: 2.902, amountRupees: 100 },
    { date: "2026-05-09", units: 2.897, amountRupees: 100 },
    { date: "2026-05-12", units: 2.928, amountRupees: 100 },
    { date: "2026-05-12", units: 3.018, amountRupees: 100 },
    { date: "2026-05-13", units: 3.01, amountRupees: 100 },
    { date: "2026-05-15", units: 3.009, amountRupees: 100 },
    { date: "2026-05-16", units: 3.02, amountRupees: 100 },
    { date: "2026-05-19", units: 3.031, amountRupees: 100 },
    { date: "2026-05-19", units: 3.066, amountRupees: 100 },
    { date: "2026-05-20", units: 3.028, amountRupees: 100 },
    { date: "2026-05-21", units: 3.007, amountRupees: 100 },
    { date: "2026-05-22", units: 3.01, amountRupees: 100 },
    { date: "2026-05-27", units: 2.969, amountRupees: 100 },
    { date: "2026-05-28", units: 2.953, amountRupees: 100 },
    { date: "2026-05-30", units: 2.972, amountRupees: 100 },
  ],
};

function unitCostPaise(amountRupees: number, units: number): number {
  return Math.round((amountRupees * 100) / units);
}

function fmt(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const holdingId = arg("--holding");
  const apply = process.argv.includes("--apply");

  if (!holdingId) {
    console.error("✗ Pass --holding <id>");
    process.exit(1);
  }
  const rows = SIP_SETS[holdingId];
  if (!rows) {
    console.error(
      `✗ No SIP set defined for holding ${holdingId}. Known ids: ${Object.keys(SIP_SETS).join(", ")}`,
    );
    process.exit(1);
  }

  await connectMongo();

  const doc = await HoldingModel.findById(holdingId).lean();
  if (!doc) {
    console.error(`✗ Holding ${holdingId} not found in this DB`);
    await disconnectMongo();
    process.exit(1);
  }
  console.log(`\nTarget holding: ${doc.symbol} (${doc.name}) on ${doc.platform}`);
  console.log(`Current quantity: ${doc.quantity}`);
  console.log(`Current lots: ${(doc.lots ?? []).length}\n`);

  console.log("Lots to add (sorted by date):");
  console.log("─".repeat(78));
  let totalCostPaise = 0;
  let totalUnits = 0;
  const prepared = rows.map((r) => {
    const unit = unitCostPaise(r.amountRupees, r.units);
    const cost = Math.round(r.units * unit);
    totalCostPaise += cost;
    totalUnits += r.units;
    console.log(
      `  ${r.date}  ${r.units.toString().padStart(8)} units  @ ${fmt(unit).padStart(11)}/unit  →  ${fmt(cost)} cost basis`,
    );
    return { date: r.date, quantity: r.units, unitCostPaise: unit };
  });
  console.log("─".repeat(78));
  console.log(`  Total: ${totalUnits.toFixed(3)} units · cost basis ${fmt(totalCostPaise)}\n`);

  if (!apply) {
    console.log("Dry-run only. Re-run with --apply to write.");
    await disconnectMongo();
    return;
  }

  console.log("Applying…\n");
  for (const lot of prepared) {
    const r = await importLot(holdingId, lot);
    console.log(`  ✓ ${lot.date}  qty now ${r.newQuantity}`);
  }

  const after = await HoldingModel.findById(holdingId).lean();
  console.log(`\nDone. Final quantity: ${after?.quantity}  ·  Final lot count: ${(after?.lots ?? []).length}`);

  await disconnectMongo();
}

main().catch((err) => {
  console.error(err);
  disconnectMongo().finally(() => process.exit(1));
});

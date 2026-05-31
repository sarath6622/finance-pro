import { ageBucket } from "./aging";
import { computeOutstanding } from "./apply-repayment";
import type {
  CounterpartyExposure,
  ExposureTotals,
  R14Result,
  ReceivableLite,
  RepaymentLite,
} from "./types";

function emptyBucketCounts() {
  return { "0-30": 0, "30-90": 0, "90+": 0, "pay-when-able": 0 };
}
function emptyBucketTotals() {
  return { "0-30": 0, "30-90": 0, "90+": 0 };
}

export function groupByCounterparty(
  receivables: ReceivableLite[],
  repaymentsByReceivableId: Map<string, RepaymentLite[]>,
  asOf: string,
): CounterpartyExposure[] {
  const byCp = new Map<string, CounterpartyExposure>();
  for (const r of receivables) {
    if (r.isDeleted) continue;
    if (r.status === "written_off") continue;
    const reps = repaymentsByReceivableId.get(r._id) ?? [];
    const { outstandingPaise } = computeOutstanding(r, reps);
    if (outstandingPaise === 0) continue;
    const bucket = ageBucket(r.dateIncurred, asOf, r.dueModel);
    const existing = byCp.get(r.counterpartyId);
    const acc =
      existing ??
      ({
        counterpartyId: r.counterpartyId,
        totalOutstandingPaise: 0,
        cashLoanPaise: 0,
        splitIouPaise: 0,
        payWhenAblePaise: 0,
        bucketCounts: emptyBucketCounts(),
        bucketTotals: emptyBucketTotals(),
        receivableIds: [],
        oldestDateIncurred: r.dateIncurred,
      } satisfies CounterpartyExposure);
    acc.totalOutstandingPaise += outstandingPaise;
    if (r.kind === "cash_loan") acc.cashLoanPaise += outstandingPaise;
    else acc.splitIouPaise += outstandingPaise;
    acc.bucketCounts[bucket] += 1;
    if (bucket === "pay-when-able") acc.payWhenAblePaise += outstandingPaise;
    else acc.bucketTotals[bucket] += outstandingPaise;
    acc.receivableIds.push(r._id);
    if (r.dateIncurred < acc.oldestDateIncurred) acc.oldestDateIncurred = r.dateIncurred;
    byCp.set(r.counterpartyId, acc);
  }
  return [...byCp.values()].sort(
    (a, b) => b.totalOutstandingPaise - a.totalOutstandingPaise,
  );
}

export function summarizeExposure(
  receivables: ReceivableLite[],
  repaymentsByReceivableId: Map<string, RepaymentLite[]>,
  asOf: string,
): R14Result {
  const perCounterparty = groupByCounterparty(
    receivables,
    repaymentsByReceivableId,
    asOf,
  );
  const totals: ExposureTotals = {
    outstandingPaise: 0,
    cashLoanPaise: 0,
    splitIouPaise: 0,
    payWhenAblePaise: 0,
    overpaymentPaise: 0,
    byBucket: emptyBucketTotals(),
    counterpartyCount: perCounterparty.length,
    hasPayWhenAble: false,
  };
  for (const cp of perCounterparty) {
    totals.outstandingPaise += cp.totalOutstandingPaise;
    totals.cashLoanPaise += cp.cashLoanPaise;
    totals.splitIouPaise += cp.splitIouPaise;
    totals.payWhenAblePaise += cp.payWhenAblePaise;
    totals.byBucket["0-30"] += cp.bucketTotals["0-30"];
    totals.byBucket["30-90"] += cp.bucketTotals["30-90"];
    totals.byBucket["90+"] += cp.bucketTotals["90+"];
    if (cp.payWhenAblePaise > 0) totals.hasPayWhenAble = true;
  }
  for (const r of receivables) {
    if (r.isDeleted || r.status === "written_off") continue;
    const reps = repaymentsByReceivableId.get(r._id) ?? [];
    const { overpaymentPaise } = computeOutstanding(r, reps);
    totals.overpaymentPaise += overpaymentPaise;
  }
  return { asOf, totals, perCounterparty };
}

import type { ReceivableLite, RepaymentLite } from "@/lib/receivables/types";
import { computeOutstanding } from "@/lib/receivables/apply-repayment";
import type { SplitBillLite } from "@/lib/splits/types";

export interface R15Bucket {
  count: number;
  totalPaise: number;
  outstandingPaise: number;
}

export interface R15Bill {
  splitBillId: string;
  sourceTransactionId: string;
  totalPaise: number;
  ownSharePaise: number;
  status: SplitBillLite["status"];
  participantCount: number;
  outstandingPaise: number;
  settledPaise: number;
  createdAt?: string;
  isTurf?: boolean;
}

export interface R15Result {
  asOf: string;
  totals: {
    bills: number;
    openCount: number;
    partialCount: number;
    settledCount: number;
    totalPaise: number;
    outstandingPaise: number;
  };
  buckets: {
    open: R15Bucket;
    partial: R15Bucket;
    settled: R15Bucket;
  };
  bills: R15Bill[];
}

function emptyBucket(): R15Bucket {
  return { count: 0, totalPaise: 0, outstandingPaise: 0 };
}

/**
 * Pure: build R15 from already-fetched SplitBills, the receivables they link
 * to, and the repayments grouped by receivable. Status reflects the bill's
 * persisted status (already recomputed on every mutation).
 */
export function buildR15(
  bills: SplitBillLite[],
  receivables: ReceivableLite[],
  repaymentsByReceivable: Map<string, RepaymentLite[]>,
  asOf: string,
  detectTurf?: (b: SplitBillLite) => boolean,
): R15Result {
  const recById = new Map(receivables.map((r) => [r._id, r]));
  const buckets = {
    open: emptyBucket(),
    partial: emptyBucket(),
    settled: emptyBucket(),
  };
  const rows: R15Bill[] = [];

  for (const bill of bills) {
    if (bill.isDeleted) continue;
    let outstanding = 0;
    let settled = 0;
    for (const p of bill.participants) {
      if (!p.receivableId) {
        // No receivable yet (e.g. participant settled without recording an IOU).
        outstanding += Math.max(0, p.sharePaise - p.settledPaise);
        settled += Math.min(p.sharePaise, p.settledPaise);
        continue;
      }
      const rec = recById.get(p.receivableId);
      if (!rec) {
        outstanding += Math.max(0, p.sharePaise - p.settledPaise);
        settled += Math.min(p.sharePaise, p.settledPaise);
        continue;
      }
      if (rec.status === "written_off") {
        // Treat as settled to the bill (owner already absorbed it as spend).
        settled += p.sharePaise;
        continue;
      }
      const reps = repaymentsByReceivable.get(rec._id) ?? [];
      const { outstandingPaise } = computeOutstanding(rec, reps);
      outstanding += outstandingPaise;
      settled += Math.max(0, p.sharePaise - outstandingPaise);
    }
    const bucket = buckets[bill.status];
    bucket.count += 1;
    bucket.totalPaise += bill.totalPaise;
    bucket.outstandingPaise += outstanding;
    rows.push({
      splitBillId: bill._id,
      sourceTransactionId: bill.sourceTransactionId,
      totalPaise: bill.totalPaise,
      ownSharePaise: bill.ownSharePaise,
      status: bill.status,
      participantCount: bill.participants.length,
      outstandingPaise: outstanding,
      settledPaise: settled,
      ...(bill.createdAt ? { createdAt: bill.createdAt } : {}),
      isTurf: detectTurf ? detectTurf(bill) : undefined,
    });
  }

  rows.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return {
    asOf,
    totals: {
      bills: rows.length,
      openCount: buckets.open.count,
      partialCount: buckets.partial.count,
      settledCount: buckets.settled.count,
      totalPaise:
        buckets.open.totalPaise + buckets.partial.totalPaise + buckets.settled.totalPaise,
      outstandingPaise:
        buckets.open.outstandingPaise +
        buckets.partial.outstandingPaise +
        buckets.settled.outstandingPaise,
    },
    buckets,
    bills: rows,
  };
}

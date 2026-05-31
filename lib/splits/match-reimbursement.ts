import { computeOutstanding } from "@/lib/receivables/apply-repayment";
import type { ReceivableLite, RepaymentLite } from "@/lib/receivables/types";
import type { MatchProposal } from "./types";

/**
 * Given the universe of (open|partial) split_iou receivables for a single counterparty
 * and the live repayments per receivable, propose the best match for an incoming
 * reimbursement_in transaction. Strategy: largest outstanding, ties → earliest dateIncurred.
 *
 * E9: cross-period reimbursement is supported naturally — the receivable persists across
 * months; we never filter by date here.
 */
export function proposeMatch(
  receivables: ReceivableLite[],
  repaymentsByReceivable: Map<string, RepaymentLite[]>,
): MatchProposal | undefined {
  const candidates: MatchProposal[] = [];
  for (const r of receivables) {
    if (r.kind !== "split_iou") continue;
    if (r.isDeleted) continue;
    if (r.status === "closed" || r.status === "written_off") continue;
    const reps = repaymentsByReceivable.get(r._id) ?? [];
    const outstanding = computeOutstanding(r, reps);
    if (outstanding.outstandingPaise <= 0) continue;
    candidates.push({
      receivableId: r._id,
      counterpartyId: r.counterpartyId,
      outstandingPaise: outstanding.outstandingPaise,
      splitId: r.splitId,
      dateIncurred: r.dateIncurred,
      kind: r.kind,
    });
  }
  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => {
    if (b.outstandingPaise !== a.outstandingPaise) {
      return b.outstandingPaise - a.outstandingPaise;
    }
    return a.dateIncurred.localeCompare(b.dateIncurred);
  });
  return candidates[0];
}

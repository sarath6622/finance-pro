import type { ParticipantLite, ParticipantStatus, SplitBillStatus } from "./types";

export function deriveParticipantStatus(
  sharePaise: number,
  settledPaise: number,
): ParticipantStatus {
  if (settledPaise <= 0) return "open";
  if (settledPaise >= sharePaise) return "settled";
  return "partial";
}

/**
 * Derive bill status from participants.
 * - settled: every participant settled (or sharePaise=0)
 * - open: no participant has any settlement
 * - partial: some progress (incl. some settled, others open)
 */
export function deriveBillStatus(participants: ParticipantLite[]): SplitBillStatus {
  if (participants.length === 0) return "open";
  let anyProgress = false;
  let allSettled = true;
  for (const p of participants) {
    const status = deriveParticipantStatus(p.sharePaise, p.settledPaise);
    if (status !== "settled") allSettled = false;
    if (status !== "open") anyProgress = true;
  }
  if (allSettled) return "settled";
  return anyProgress ? "partial" : "open";
}

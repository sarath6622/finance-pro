import type { ProposedShare } from "./types";

export class ShareValidationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "sum_mismatch"
      | "negative_share"
      | "no_participants"
      | "own_share_negative"
      | "own_share_exceeds_total",
  ) {
    super(message);
    this.name = "ShareValidationError";
  }
}

/**
 * Split totalPaise into N equal shares so the rupee sum is exact.
 * Remainder paise are distributed to the first `remainder` shares.
 * Caller decides whether the owner is one of the N or excluded.
 */
export function equalShares(totalPaise: number, n: number): number[] {
  if (n <= 0) throw new ShareValidationError("n must be >= 1", "no_participants");
  if (totalPaise < 0) throw new ShareValidationError("totalPaise must be >= 0", "negative_share");
  const base = Math.floor(totalPaise / n);
  const remainder = totalPaise - base * n;
  const out = new Array(n).fill(base) as number[];
  for (let i = 0; i < remainder; i++) out[i] = (out[i] ?? 0) + 1;
  return out;
}

/**
 * Turf-style: a fixed unit cost split N ways (e.g. ₹1500 / 6 players).
 * Returns { totalPaise, perPlayerPaise, shares: number[] }.
 */
export function turfShares(
  unitPaise: number,
  players: number,
): { totalPaise: number; shares: number[] } {
  if (players <= 0) {
    throw new ShareValidationError("players must be >= 1", "no_participants");
  }
  if (unitPaise <= 0) {
    throw new ShareValidationError("unitPaise must be > 0", "negative_share");
  }
  const totalPaise = unitPaise * players;
  return { totalPaise, shares: equalShares(totalPaise, players) };
}

/**
 * Validate that ownShare + Σ participants.share === totalPaise (in paise).
 * Throws on any structural problem so the caller never has to repeat checks.
 */
export function validateShares(
  totalPaise: number,
  ownSharePaise: number,
  participants: ProposedShare[],
): void {
  if (totalPaise <= 0) {
    throw new ShareValidationError("totalPaise must be > 0", "sum_mismatch");
  }
  if (ownSharePaise < 0) {
    throw new ShareValidationError("ownSharePaise must be >= 0", "own_share_negative");
  }
  if (ownSharePaise > totalPaise) {
    throw new ShareValidationError(
      "ownSharePaise cannot exceed totalPaise",
      "own_share_exceeds_total",
    );
  }
  if (participants.length === 0) {
    throw new ShareValidationError("at least one participant is required", "no_participants");
  }
  let sum = ownSharePaise;
  for (const p of participants) {
    if (!Number.isInteger(p.sharePaise) || p.sharePaise < 0) {
      throw new ShareValidationError(
        `sharePaise must be a non-negative integer (got ${p.sharePaise})`,
        "negative_share",
      );
    }
    sum += p.sharePaise;
  }
  if (sum !== totalPaise) {
    throw new ShareValidationError(
      `shares sum (${sum}) does not match totalPaise (${totalPaise})`,
      "sum_mismatch",
    );
  }
}

/**
 * Build an equal-share proposal across counterparties + owner.
 * `includeOwner=true` → owner takes one of the N base shares.
 */
export function proposeEqualParticipants(
  totalPaise: number,
  counterpartyIds: string[],
  opts: { includeOwner: boolean; dueModel?: "on_date" | "when_able" | "none" } = {
    includeOwner: true,
  },
): { ownSharePaise: number; participants: ProposedShare[] } {
  const ownerCount = opts.includeOwner ? 1 : 0;
  const totalCount = counterpartyIds.length + ownerCount;
  if (totalCount === 0) {
    throw new ShareValidationError("at least one participant required", "no_participants");
  }
  const shares = equalShares(totalPaise, totalCount);
  const ownSharePaise = ownerCount > 0 ? (shares[0] ?? 0) : 0;
  const others = ownerCount > 0 ? shares.slice(1) : shares;
  const participants: ProposedShare[] = counterpartyIds.map((cp, idx) => ({
    counterpartyId: cp,
    sharePaise: others[idx] ?? 0,
    dueModel: opts.dueModel ?? "when_able",
  }));
  return { ownSharePaise, participants };
}

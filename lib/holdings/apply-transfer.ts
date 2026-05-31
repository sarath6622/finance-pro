import type { HoldingLite, LotLite, TransferInput } from "./types";
import {
  fromMicroUnits,
  qtyAdd,
  qtySub,
  toMicroUnits,
} from "./quantity";

export class TransferError extends Error {
  constructor(public code: "insufficient_qty" | "same_platform") {
    super(code);
    this.name = "TransferError";
  }
}

export interface TransferResult {
  /** The source holding after the transferred lots have been carved out. */
  from: HoldingLite;
  /**
   * A "candidate destination patch" — lots & quantity to merge into a holding
   * on the destination platform. The lifecycle layer either creates a new
   * Holding doc for `toPlatform` or merges into an existing one (same
   * symbol+assetType+platform).
   */
  movedLots: LotLite[];
  movedQuantity: number;
  toPlatform: string;
}

/**
 * Pure (E35): move `quantity` units from `holding.platform` to `transfer.toPlatform`.
 *   - FIFO carve from the source lots (oldest first), preserving each lot's
 *     unitCost so the destination keeps the same cost basis.
 *   - No realized P&L (this is not a sale).
 *   - If `toPlatform === holding.platform`, throw — it's not a transfer.
 */
export function applyTransfer(holding: HoldingLite, transfer: TransferInput): TransferResult {
  if (transfer.quantity <= 0) throw new Error("transfer quantity must be > 0");
  if (transfer.toPlatform === holding.platform) {
    throw new TransferError("same_platform");
  }
  if (toMicroUnits(transfer.quantity) > toMicroUnits(holding.quantity)) {
    throw new TransferError("insufficient_qty");
  }

  let remaining = toMicroUnits(transfer.quantity);
  const remainingLots: LotLite[] = [];
  const movedLots: LotLite[] = [];
  for (const lot of holding.lots) {
    if (remaining <= 0) {
      remainingLots.push(lot);
      continue;
    }
    const lotMicro = toMicroUnits(lot.quantity);
    if (lotMicro === 0) continue;
    if (lotMicro <= remaining) {
      // Entire lot moves.
      movedLots.push({ ...lot });
      remaining -= lotMicro;
    } else {
      const moveQty = fromMicroUnits(remaining);
      const keepQty = fromMicroUnits(lotMicro - remaining);
      movedLots.push({ ...lot, quantity: moveQty });
      remainingLots.push({ ...lot, quantity: keepQty });
      remaining = 0;
    }
  }
  return {
    from: {
      ...holding,
      quantity: qtySub(holding.quantity, transfer.quantity),
      lots: remainingLots,
    },
    movedLots,
    movedQuantity: transfer.quantity,
    toPlatform: transfer.toPlatform,
  };
}

/**
 * Pure (E35): merge transferred lots into a destination holding (same
 * symbol+assetType, different platform). Preserves FIFO order by date.
 */
export function mergeTransferredLots(
  dest: HoldingLite,
  movedLots: LotLite[],
  movedQuantity: number,
): HoldingLite {
  const merged = [...dest.lots, ...movedLots].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  return {
    ...dest,
    quantity: qtyAdd(dest.quantity, movedQuantity),
    lots: merged,
  };
}

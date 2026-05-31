import type {
  HoldingLite,
  LotConsumption,
  LotLite,
  SellInput,
  SellResult,
} from "./types";
import {
  fromMicroUnits,
  qtyAdd,
  qtySub,
  qtyTimesPaise,
  toMicroUnits,
} from "./quantity";

export class SellOverflowError extends Error {
  constructor(public requested: number, public available: number) {
    super(`Sell quantity ${requested} exceeds available ${available}`);
    this.name = "SellOverflowError";
  }
}

/**
 * Pure FIFO sell:
 *   - Consume lots in date order until `sell.quantity` is satisfied.
 *   - For each consumed slice: realizedPnL = qtyConsumed × (sellPrice − lotCost).
 *   - Partial-lot consumption leaves the remainder in place (E34).
 *   - Throws SellOverflowError if requested qty > available.
 *
 * Returns:
 *   - the holding with lots reduced + quantity decremented + realized P&L added
 *   - per-lot consumption breakdown (used for audit and on-screen "sold from lot dated X")
 *   - total realized P&L paise and total proceeds paise
 */
export function applySell(holding: HoldingLite, sell: SellInput): SellResult {
  if (sell.quantity <= 0) throw new Error("sell quantity must be > 0");
  if (!Number.isFinite(sell.unitPricePaise) || sell.unitPricePaise < 0) {
    throw new Error("unitPricePaise must be a finite non-negative integer");
  }
  if (!Number.isInteger(sell.unitPricePaise)) {
    throw new Error("unitPricePaise must be integer paise");
  }

  const available = holding.quantity;
  if (toMicroUnits(sell.quantity) > toMicroUnits(available)) {
    throw new SellOverflowError(sell.quantity, available);
  }

  let remaining = toMicroUnits(sell.quantity);
  const newLots: LotLite[] = [];
  const consumed: LotConsumption[] = [];
  let realizedPnL = 0;
  let proceeds = 0;

  holding.lots.forEach((lot, idx) => {
    if (remaining <= 0) {
      newLots.push(lot);
      return;
    }
    const lotMicro = toMicroUnits(lot.quantity);
    if (lotMicro === 0) {
      // skip empty lots (shouldn't exist, but defensive)
      return;
    }
    const consumeMicro = Math.min(lotMicro, remaining);
    const consumeQty = fromMicroUnits(consumeMicro);
    const costBasisPaise = qtyTimesPaise(consumeQty, lot.unitCostPaise);
    const proceedsPaise = qtyTimesPaise(consumeQty, sell.unitPricePaise);
    const pnl = proceedsPaise - costBasisPaise;

    consumed.push({
      lotIndex: idx,
      lotDate: lot.date,
      qtyConsumed: consumeQty,
      costBasisPaise,
      proceedsPaise,
      realizedPnLPaise: pnl,
    });
    realizedPnL += pnl;
    proceeds += proceedsPaise;
    remaining -= consumeMicro;

    const leftMicro = lotMicro - consumeMicro;
    if (leftMicro > 0) {
      newLots.push({
        ...lot,
        quantity: fromMicroUnits(leftMicro),
      });
    }
    // else lot fully consumed → drop
  });

  if (remaining > 0) {
    // Defensive — should not be reachable because we precheck above.
    throw new SellOverflowError(sell.quantity, available);
  }

  return {
    holding: {
      ...holding,
      quantity: qtySub(holding.quantity, sell.quantity),
      lots: newLots,
      realizedPnLPaise: holding.realizedPnLPaise + realizedPnL,
    },
    consumed,
    realizedPnLPaise: realizedPnL,
    totalProceedsPaise: proceeds,
  };
}

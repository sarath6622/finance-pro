/**
 * Fixed-point quantity arithmetic at 8-decimal precision (matches crypto needs).
 *
 * JS `number` can exactly represent integers up to 2^53; an 8dp quantity of
 * 1,000,000 BTC is 1e14 micro-units — safely inside that range. We do all
 * arithmetic in integer micro-units to avoid float drift, then convert back
 * for display / persistence.
 */

const SCALE = 100_000_000; // 1e8

/** Decimal quantity → integer micro-units (rounded to 8 dp). */
export function toMicroUnits(qty: number): number {
  if (!Number.isFinite(qty)) throw new Error(`quantity not finite: ${qty}`);
  return Math.round(qty * SCALE);
}

/** Integer micro-units → decimal quantity. */
export function fromMicroUnits(micro: number): number {
  return micro / SCALE;
}

/** Compare two decimal quantities at 8dp precision. */
export function qtyEqual(a: number, b: number): boolean {
  return toMicroUnits(a) === toMicroUnits(b);
}

/** Add two decimal quantities, returning a value rounded to 8 dp. */
export function qtyAdd(a: number, b: number): number {
  return fromMicroUnits(toMicroUnits(a) + toMicroUnits(b));
}

/** Subtract two decimal quantities (a − b), returning rounded to 8 dp. */
export function qtySub(a: number, b: number): number {
  return fromMicroUnits(toMicroUnits(a) - toMicroUnits(b));
}

/**
 * Multiply a quantity by an integer paise price, returning the paise total.
 * Rounded half-away-from-zero to the nearest paise (no fractional paise).
 */
export function qtyTimesPaise(qty: number, paise: number): number {
  if (!Number.isInteger(paise)) throw new Error("paise must be integer");
  if (!Number.isFinite(qty)) throw new Error("qty must be finite");
  // qty (8dp) × paise (int) — keep precision via integer multiply when possible.
  const sign = qty < 0 || paise < 0 ? -1 : 1;
  const microQty = toMicroUnits(Math.abs(qty));
  const product = microQty * Math.abs(paise);
  // product is in 1e8-units of paise; round-half-away to nearest paise
  const rounded = Math.round(product / SCALE);
  return sign * rounded;
}

/** Multiply a quantity by a decimal ratio (e.g. 2/1 for a 2:1 split). */
export function qtyTimesRatio(qty: number, numerator: number, denominator: number): number {
  if (denominator === 0) throw new Error("denominator cannot be 0");
  // Stay in integer microUnits as long as possible.
  const microQty = toMicroUnits(qty);
  const scaled = (microQty * numerator) / denominator;
  return fromMicroUnits(Math.round(scaled));
}

/**
 * Apply a corporate-action ratio to a paise cost so the *total* cost basis is
 * conserved. For an N:M split where qty becomes qty × (N/M), the per-unit
 * cost must become cost × (M/N).
 */
export function paiseDivideRatio(paise: number, numerator: number, denominator: number): number {
  if (numerator === 0) throw new Error("numerator cannot be 0");
  return Math.round((paise * denominator) / numerator);
}

export const QUANTITY_SCALE = SCALE;

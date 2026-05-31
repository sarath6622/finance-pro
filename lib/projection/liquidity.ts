/**
 * Liquidity forecast (R9) — pure.
 *
 * Given today's cash + a list of scheduled outflows/inflows between today and
 * the next payday, compute the projected balance at end-of-day for every day
 * in the window. The forecast feeds:
 *   - dashboard "floor breach" alert (FR-24)
 *   - lend-safety check (FR-25): would adding ₹X drop the min below the floor?
 *   - R10 burn-down (salary → zero over the cycle)
 */

export interface ScheduledFlow {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Signed paise: outflow negative, inflow positive */
  signedPaise: number;
  /** Free-form label (e.g. "Dad ₹25k", "Rent", "Jumbo EMI") */
  label: string;
  /** "obligation" | "recurring" | "lending_out" | "manual" | "payday" */
  source?: string;
}

export interface ForecastInput {
  /** Today, ISO date (YYYY-MM-DD). Forecast starts at end-of-this-day. */
  asOf: string;
  /** Total liquid cash (assets in `bank` / `cash` / `wallet`) right now, paise. */
  currentLiquidPaise: number;
  /** Liquidity floor target, paise. Defaults applied by caller. */
  floorPaise: number;
  /** Inflows/outflows between asOf and horizonEnd. Order doesn't matter — we sort. */
  flows: ScheduledFlow[];
  /** Last day to include (inclusive), ISO date. Typically next payday or asOf+30. */
  horizonEnd: string;
}

export interface ForecastDay {
  date: string;
  /** End-of-day balance after all flows on this date are applied. */
  endPaise: number;
  /** Per-day net flow (sum of signedPaise on this date). */
  netPaise: number;
  /** Floor headroom = endPaise - floorPaise; negative means breached. */
  headroomPaise: number;
  /** True if endPaise < floorPaise. */
  belowFloor: boolean;
  /** True if endPaise < 0 (overdraft, E15). */
  overdrawn: boolean;
}

export interface ForecastResult {
  asOf: string;
  horizonEnd: string;
  startingPaise: number;
  floorPaise: number;
  days: ForecastDay[];
  /** Lowest endPaise across the window (min balance ahead). */
  minPaise: number;
  /** Day on which minPaise occurs. */
  minDate: string;
  /** First date where balance dips below floor, if any. */
  firstFloorBreachDate?: string;
  /** First date where balance dips below 0 (overdraft), if any. */
  firstOverdraftDate?: string;
  /** Net change start → end of window. */
  netChangePaise: number;
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  let cur = fromIso.slice(0, 10);
  const end = toIso.slice(0, 10);
  if (cur > end) return [];
  while (cur <= end) {
    out.push(cur);
    cur = nextDay(cur);
  }
  return out;
}

/**
 * Project end-of-day balance for every date in [asOf, horizonEnd].
 *
 * The starting balance is treated as the balance AT THE START of asOf. All
 * flows dated on asOf are applied to give the day's end balance — so a
 * flow dated today is in the projection (it hasn't cleared yet).
 */
export function forecast(input: ForecastInput): ForecastResult {
  const dates = daysBetween(input.asOf, input.horizonEnd);
  if (dates.length === 0) {
    return {
      asOf: input.asOf,
      horizonEnd: input.horizonEnd,
      startingPaise: input.currentLiquidPaise,
      floorPaise: input.floorPaise,
      days: [],
      minPaise: input.currentLiquidPaise,
      minDate: input.asOf,
      netChangePaise: 0,
    };
  }
  const flowsByDate = new Map<string, number>();
  for (const f of input.flows) {
    const key = f.date.slice(0, 10);
    if (key < input.asOf || key > input.horizonEnd) continue;
    flowsByDate.set(key, (flowsByDate.get(key) ?? 0) + f.signedPaise);
  }

  let running = input.currentLiquidPaise;
  let minPaise = running;
  let minDate = input.asOf;
  let firstFloorBreachDate: string | undefined;
  let firstOverdraftDate: string | undefined;
  const days: ForecastDay[] = [];

  for (const date of dates) {
    const net = flowsByDate.get(date) ?? 0;
    running += net;
    const headroom = running - input.floorPaise;
    const belowFloor = running < input.floorPaise;
    const overdrawn = running < 0;
    days.push({
      date,
      endPaise: running,
      netPaise: net,
      headroomPaise: headroom,
      belowFloor,
      overdrawn,
    });
    if (running < minPaise) {
      minPaise = running;
      minDate = date;
    }
    if (belowFloor && firstFloorBreachDate === undefined) firstFloorBreachDate = date;
    if (overdrawn && firstOverdraftDate === undefined) firstOverdraftDate = date;
  }

  const lastDay = days[days.length - 1]!;
  return {
    asOf: input.asOf,
    horizonEnd: input.horizonEnd,
    startingPaise: input.currentLiquidPaise,
    floorPaise: input.floorPaise,
    days,
    minPaise,
    minDate,
    ...(firstFloorBreachDate ? { firstFloorBreachDate } : {}),
    ...(firstOverdraftDate ? { firstOverdraftDate } : {}),
    netChangePaise: lastDay.endPaise - input.currentLiquidPaise,
  };
}

/* ----------------------------------------------------------------------- */
/* Lend-safety check (FR-25)                                                */
/* ----------------------------------------------------------------------- */

export interface LendSafetyInput {
  baseline: ForecastResult;
  /** ISO date of the proposed lend (defaults to baseline.asOf). */
  date?: string;
  /** Paise the owner would lend out (positive). */
  amountPaise: number;
}

export interface LendSafetyResult {
  proposedDate: string;
  amountPaise: number;
  baselineMinPaise: number;
  hypotheticalMinPaise: number;
  hypotheticalMinDate: string;
  /** True if the proposal moves the floor-breach from no→yes (or worsens it). */
  wouldBreachFloor: boolean;
  /** True if the proposal would push any day into overdraft. */
  wouldOverdraw: boolean;
  /** Suggested safe-to-lend ceiling = baselineMin − floor (clamped to 0). */
  safeLendCeilingPaise: number;
  floorPaise: number;
}

/**
 * Pure: re-run the forecast with an extra outflow on `date` and return
 * whether the min balance now drops below the floor (or zero). Cheap (O(days)).
 */
export function lendSafetyCheck(input: LendSafetyInput): LendSafetyResult {
  const baseline = input.baseline;
  const date = (input.date ?? baseline.asOf).slice(0, 10);
  if (input.amountPaise <= 0) {
    throw new Error("amountPaise must be > 0");
  }
  let hypotheticalMin = baseline.startingPaise;
  let hypotheticalMinDate = baseline.asOf;
  let wouldOverdraw = false;
  let wouldBreachFloor = false;

  for (const d of baseline.days) {
    const extra = d.date >= date ? -input.amountPaise : 0;
    const projected = d.endPaise + extra;
    if (projected < hypotheticalMin) {
      hypotheticalMin = projected;
      hypotheticalMinDate = d.date;
    }
    if (projected < 0) wouldOverdraw = true;
    if (projected < baseline.floorPaise) wouldBreachFloor = true;
  }

  const safeLendCeiling = Math.max(0, baseline.minPaise - baseline.floorPaise);
  return {
    proposedDate: date,
    amountPaise: input.amountPaise,
    baselineMinPaise: baseline.minPaise,
    hypotheticalMinPaise: hypotheticalMin,
    hypotheticalMinDate,
    wouldBreachFloor,
    wouldOverdraw,
    safeLendCeilingPaise: safeLendCeiling,
    floorPaise: baseline.floorPaise,
  };
}

/* ----------------------------------------------------------------------- */
/* Pay-cycle burn-down (R10)                                                */
/* ----------------------------------------------------------------------- */

export interface BurnDownInput {
  /** Pay-cycle start date — usually payday */
  cycleStart: string;
  /** Inclusive cycle end (day before next payday) */
  cycleEnd: string;
  /** Salary credited on cycleStart, paise */
  paydayInflowPaise: number;
  /** Other flows during the cycle — same signed-paise convention as forecast */
  flows: ScheduledFlow[];
}

export interface BurnDownResult {
  cycleStart: string;
  cycleEnd: string;
  paydayInflowPaise: number;
  totalDays: number;
  daysElapsed: number;
  /** Running balance per day starting at paydayInflowPaise after salary credit. */
  curve: Array<{ date: string; balancePaise: number; netPaise: number }>;
  /** Linear "fair-burn" target for each day (paydayInflow * (1 - elapsedFraction)). */
  idealCurve: Array<{ date: string; idealPaise: number }>;
  /** True spend in cycle (negative flows excluding "transfer"-like). */
  totalOutflowPaise: number;
}

export function burnDown(input: BurnDownInput, asOf?: string): BurnDownResult {
  const dates = daysBetween(input.cycleStart, input.cycleEnd);
  const flowsByDate = new Map<string, number>();
  for (const f of input.flows) {
    const key = f.date.slice(0, 10);
    if (key < input.cycleStart || key > input.cycleEnd) continue;
    flowsByDate.set(key, (flowsByDate.get(key) ?? 0) + f.signedPaise);
  }
  // Treat the payday inflow as a +inflow on day 0.
  flowsByDate.set(
    input.cycleStart,
    (flowsByDate.get(input.cycleStart) ?? 0) + input.paydayInflowPaise,
  );
  let running = 0;
  let outflow = 0;
  const curve: BurnDownResult["curve"] = [];
  for (const d of dates) {
    const net = flowsByDate.get(d) ?? 0;
    running += net;
    if (net < 0) outflow += -net;
    curve.push({ date: d, balancePaise: running, netPaise: net });
  }
  const totalDays = dates.length;
  const today = (asOf ?? input.cycleStart).slice(0, 10);
  const elapsedIdx = Math.max(
    0,
    Math.min(totalDays - 1, dates.findIndex((d) => d >= today)),
  );
  const idealCurve = dates.map((d, i) => {
    const elapsedFraction = totalDays > 1 ? i / (totalDays - 1) : 1;
    return {
      date: d,
      idealPaise: Math.round(input.paydayInflowPaise * (1 - elapsedFraction)),
    };
  });
  return {
    cycleStart: input.cycleStart,
    cycleEnd: input.cycleEnd,
    paydayInflowPaise: input.paydayInflowPaise,
    totalDays,
    daysElapsed: elapsedIdx + 1,
    curve,
    idealCurve,
    totalOutflowPaise: outflow,
  };
}

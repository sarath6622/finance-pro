import { describe, expect, it } from "vitest";
import { burnDown, forecast, lendSafetyCheck } from "./liquidity";
import { rupees } from "./amortization";

describe("forecast — base behaviours", () => {
  it("empty flow list: every day reports the same balance", () => {
    const r = forecast({
      asOf: "2026-06-01",
      currentLiquidPaise: rupees(100000),
      floorPaise: rupees(50000),
      flows: [],
      horizonEnd: "2026-06-05",
    });
    expect(r.days).toHaveLength(5);
    expect(r.days.every((d) => d.endPaise === rupees(100000))).toBe(true);
    expect(r.minPaise).toBe(rupees(100000));
    expect(r.firstFloorBreachDate).toBeUndefined();
    expect(r.netChangePaise).toBe(0);
  });

  it("a same-day outflow is applied to the asOf day (the flow has occurred)", () => {
    const r = forecast({
      asOf: "2026-06-01",
      currentLiquidPaise: rupees(100000),
      floorPaise: 0,
      flows: [{ date: "2026-06-01", signedPaise: -rupees(20000), label: "Rent" }],
      horizonEnd: "2026-06-03",
    });
    expect(r.days[0]!.endPaise).toBe(rupees(80000));
    expect(r.days[0]!.netPaise).toBe(-rupees(20000));
    expect(r.minPaise).toBe(rupees(80000));
    expect(r.netChangePaise).toBe(-rupees(20000));
  });

  it("flags the first floor breach day and the first overdraft day separately (E15)", () => {
    const r = forecast({
      asOf: "2026-06-01",
      currentLiquidPaise: rupees(60000),
      floorPaise: rupees(50000),
      flows: [
        { date: "2026-06-02", signedPaise: -rupees(20000), label: "Big bill" }, // 40k — below floor
        { date: "2026-06-04", signedPaise: -rupees(50000), label: "Bigger bill" }, // -10k — overdraft
      ],
      horizonEnd: "2026-06-05",
    });
    expect(r.firstFloorBreachDate).toBe("2026-06-02");
    expect(r.firstOverdraftDate).toBe("2026-06-04");
    expect(r.minPaise).toBe(-rupees(10000));
    expect(r.minDate).toBe("2026-06-04");
  });

  it("ignores flows outside the [asOf, horizonEnd] window", () => {
    const r = forecast({
      asOf: "2026-06-05",
      currentLiquidPaise: rupees(100000),
      floorPaise: 0,
      flows: [
        { date: "2026-06-01", signedPaise: -rupees(20000), label: "past" },
        { date: "2026-06-20", signedPaise: -rupees(20000), label: "after horizon" },
        { date: "2026-06-08", signedPaise: -rupees(10000), label: "inside" },
      ],
      horizonEnd: "2026-06-10",
    });
    expect(r.minPaise).toBe(rupees(90000));
    expect(r.netChangePaise).toBe(-rupees(10000));
  });

  it("handles inflows (payday-like) mid-window", () => {
    const r = forecast({
      asOf: "2026-06-01",
      currentLiquidPaise: rupees(20000),
      floorPaise: rupees(50000),
      flows: [
        { date: "2026-06-03", signedPaise: -rupees(10000), label: "rent" },
        { date: "2026-06-05", signedPaise: rupees(100000), label: "payday" },
      ],
      horizonEnd: "2026-06-06",
    });
    expect(r.minPaise).toBe(rupees(10000));
    expect(r.firstFloorBreachDate).toBe("2026-06-01");
    expect(r.days[r.days.length - 1]!.endPaise).toBe(rupees(110000));
  });

  it("degenerate: asOf > horizonEnd returns empty days but consistent fields", () => {
    const r = forecast({
      asOf: "2026-06-10",
      currentLiquidPaise: rupees(100000),
      floorPaise: 0,
      flows: [],
      horizonEnd: "2026-06-01",
    });
    expect(r.days).toEqual([]);
    expect(r.minPaise).toBe(rupees(100000));
    expect(r.netChangePaise).toBe(0);
  });
});

describe("lendSafetyCheck (FR-25)", () => {
  const baseline = forecast({
    asOf: "2026-06-01",
    currentLiquidPaise: rupees(100000),
    floorPaise: rupees(50000),
    flows: [
      { date: "2026-06-10", signedPaise: -rupees(30000), label: "Rent" },
    ],
    horizonEnd: "2026-06-30",
  });

  it("baseline does not breach the floor", () => {
    expect(baseline.minPaise).toBe(rupees(70000));
    expect(baseline.firstFloorBreachDate).toBeUndefined();
  });

  it("a small ₹5k lend leaves headroom — no breach", () => {
    const r = lendSafetyCheck({ baseline, amountPaise: rupees(5000) });
    expect(r.wouldBreachFloor).toBe(false);
    expect(r.wouldOverdraw).toBe(false);
    expect(r.hypotheticalMinPaise).toBe(rupees(65000));
    expect(r.safeLendCeilingPaise).toBe(rupees(20000));
  });

  it("a ₹30k lend pushes min below floor → breach", () => {
    const r = lendSafetyCheck({ baseline, amountPaise: rupees(30000) });
    expect(r.wouldBreachFloor).toBe(true);
    expect(r.wouldOverdraw).toBe(false);
    expect(r.hypotheticalMinPaise).toBe(rupees(40000));
  });

  it("a ₹100k lend would overdraw", () => {
    const r = lendSafetyCheck({ baseline, amountPaise: rupees(100000) });
    expect(r.wouldBreachFloor).toBe(true);
    expect(r.wouldOverdraw).toBe(true);
    expect(r.hypotheticalMinPaise).toBeLessThan(0);
  });

  it("safeLendCeiling equals baselineMin − floor, never negative", () => {
    const tight = forecast({
      asOf: "2026-06-01",
      currentLiquidPaise: rupees(50000),
      floorPaise: rupees(50000),
      flows: [],
      horizonEnd: "2026-06-30",
    });
    const r = lendSafetyCheck({ baseline: tight, amountPaise: 1 });
    expect(r.safeLendCeilingPaise).toBe(0);
  });

  it("dating the lend after a known inflow leaves earlier days unaffected", () => {
    // Lend on Jun-15, but min was Jun-10 in baseline. The lend doesn't change min.
    const r = lendSafetyCheck({
      baseline,
      amountPaise: rupees(20000),
      date: "2026-06-15",
    });
    // Min stays at Jun-10's ₹70k (the lend is later).
    expect(r.hypotheticalMinPaise).toBe(rupees(50000));
  });

  it("rejects non-positive amounts", () => {
    expect(() => lendSafetyCheck({ baseline, amountPaise: 0 })).toThrow();
    expect(() => lendSafetyCheck({ baseline, amountPaise: -1 })).toThrow();
  });
});

describe("burnDown (R10)", () => {
  it("traces salary → zero across the cycle linearly with flat daily spend", () => {
    const r = burnDown({
      cycleStart: "2026-06-05",
      cycleEnd: "2026-06-09",
      paydayInflowPaise: rupees(5000),
      flows: [
        { date: "2026-06-06", signedPaise: -rupees(1000), label: "d1" },
        { date: "2026-06-07", signedPaise: -rupees(1000), label: "d2" },
        { date: "2026-06-08", signedPaise: -rupees(1000), label: "d3" },
        { date: "2026-06-09", signedPaise: -rupees(2000), label: "d4" },
      ],
    });
    expect(r.totalDays).toBe(5);
    expect(r.curve.map((c) => c.balancePaise)).toEqual([
      rupees(5000), // pay day
      rupees(4000),
      rupees(3000),
      rupees(2000),
      rupees(0),
    ]);
    // Ideal: linear from 5000 → 0
    expect(r.idealCurve[0]!.idealPaise).toBe(rupees(5000));
    expect(r.idealCurve[r.idealCurve.length - 1]!.idealPaise).toBe(0);
  });

  it("totalOutflowPaise sums only negative flows (excludes payday inflow)", () => {
    const r = burnDown({
      cycleStart: "2026-06-05",
      cycleEnd: "2026-06-06",
      paydayInflowPaise: rupees(1000),
      flows: [{ date: "2026-06-06", signedPaise: -rupees(300), label: "d" }],
    });
    expect(r.totalOutflowPaise).toBe(rupees(300));
  });
});

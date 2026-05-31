import { describe, it, expect } from "vitest";
import {
  buildPeriod,
  isInPeriod,
  periodForDate,
  periodKey,
  shiftPeriod,
} from "./period";

describe("buildPeriod — calendar mode", () => {
  it("returns full month for a 31-day month", () => {
    const p = buildPeriod({ mode: "calendar", anchorDay: 5, year: 2026, month: 5 });
    expect(p.start).toBe("2026-05-01");
    expect(p.endInclusive).toBe("2026-05-31");
    expect(p.label).toBe("May 2026");
  });

  it("returns full month for a 28-day February (non-leap)", () => {
    const p = buildPeriod({ mode: "calendar", anchorDay: 5, year: 2025, month: 2 });
    expect(p.endInclusive).toBe("2025-02-28");
  });

  it("returns Feb 29 in a leap year", () => {
    const p = buildPeriod({ mode: "calendar", anchorDay: 5, year: 2028, month: 2 });
    expect(p.endInclusive).toBe("2028-02-29");
  });
});

describe("buildPeriod — pay_cycle mode (E11, FR-12)", () => {
  it("May 2026 cycle anchored on day 5 spans May 5 to June 4", () => {
    const p = buildPeriod({ mode: "pay_cycle", anchorDay: 5, year: 2026, month: 5 });
    expect(p.start).toBe("2026-05-05");
    expect(p.endInclusive).toBe("2026-06-04");
    expect(p.label).toContain("cycle");
  });

  it("Dec 2026 cycle wraps into the new year", () => {
    const p = buildPeriod({ mode: "pay_cycle", anchorDay: 5, year: 2026, month: 12 });
    expect(p.start).toBe("2026-12-05");
    expect(p.endInclusive).toBe("2027-01-04");
  });

  it("Anchor day 31 clamps to last day of month (Feb 2026: 28)", () => {
    const p = buildPeriod({ mode: "pay_cycle", anchorDay: 31, year: 2026, month: 2 });
    expect(p.start).toBe("2026-02-28");
    // March has 31 days so the next cycle starts Mar 31; previous cycle ends Mar 30.
    expect(p.endInclusive).toBe("2026-03-30");
  });
});

describe("periodForDate", () => {
  it("calendar: date returns its own month", () => {
    const p = periodForDate("2026-05-30", "calendar", 5);
    expect(p.start).toBe("2026-05-01");
  });

  it("pay_cycle: date on or after anchor belongs to that month's cycle", () => {
    const p = periodForDate("2026-05-05", "pay_cycle", 5);
    expect(p.start).toBe("2026-05-05");
  });

  it("pay_cycle: date before anchor belongs to prior month's cycle", () => {
    const p = periodForDate("2026-05-04", "pay_cycle", 5);
    expect(p.start).toBe("2026-04-05");
    expect(p.endInclusive).toBe("2026-05-04");
  });

  it("pay_cycle Jan: dates before anchor belong to prior Dec cycle", () => {
    const p = periodForDate("2026-01-03", "pay_cycle", 5);
    expect(p.start).toBe("2025-12-05");
    expect(p.endInclusive).toBe("2026-01-04");
  });
});

describe("shiftPeriod", () => {
  it("steps forward and backward by month", () => {
    const may = buildPeriod({ mode: "calendar", anchorDay: 5, year: 2026, month: 5 });
    const jun = shiftPeriod(may, 1);
    expect(jun.month).toBe(6);
    expect(jun.year).toBe(2026);
    const apr = shiftPeriod(may, -1);
    expect(apr.month).toBe(4);
    const lastYear = shiftPeriod(may, -12);
    expect(lastYear.year).toBe(2025);
    expect(lastYear.month).toBe(5);
  });
});

describe("isInPeriod", () => {
  const p = buildPeriod({ mode: "pay_cycle", anchorDay: 5, year: 2026, month: 5 });
  it("includes boundaries (inclusive)", () => {
    expect(isInPeriod("2026-05-05", p)).toBe(true);
    expect(isInPeriod("2026-06-04", p)).toBe(true);
  });
  it("excludes outside", () => {
    expect(isInPeriod("2026-05-04", p)).toBe(false);
    expect(isInPeriod("2026-06-05", p)).toBe(false);
  });
  it("accepts ISO timestamps (slices to date)", () => {
    expect(isInPeriod("2026-05-30T23:59:00.000Z", p)).toBe(true);
  });
});

describe("periodKey", () => {
  it("returns YYYY-MM", () => {
    const p = buildPeriod({ mode: "calendar", anchorDay: 5, year: 2026, month: 5 });
    expect(periodKey(p)).toBe("2026-05");
  });
});

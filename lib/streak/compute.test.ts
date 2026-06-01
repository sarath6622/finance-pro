import { describe, expect, it } from "vitest";
import { computeStreak, type StreakTxn } from "./compute";

function txn(valueDate: string, opts: Partial<StreakTxn> = {}): StreakTxn {
  return {
    valueDate,
    source: opts.source ?? "manual",
    isDeleted: opts.isDeleted ?? false,
  };
}

describe("computeStreak", () => {
  it("returns all-zero when there are no transactions", () => {
    expect(computeStreak([], "2026-06-01")).toEqual({
      current: 0,
      longest: 0,
      lastLoggedDate: null,
    });
  });

  it("returns all-zero when every transaction is deleted", () => {
    const txns = [
      txn("2026-06-01", { isDeleted: true }),
      txn("2026-05-31", { isDeleted: true }),
    ];
    expect(computeStreak(txns, "2026-06-01")).toMatchObject({ current: 0, longest: 0 });
  });

  it("excludes recurring-auto transactions from the streak", () => {
    const txns = [
      txn("2026-06-01", { source: "recurring" }),
      txn("2026-05-31", { source: "recurring" }),
    ];
    expect(computeStreak(txns, "2026-06-01")).toEqual({
      current: 0,
      longest: 0,
      lastLoggedDate: null,
    });
  });

  it("counts current streak ending today", () => {
    const txns = [
      txn("2026-06-01"),
      txn("2026-05-31"),
      txn("2026-05-30"),
    ];
    expect(computeStreak(txns, "2026-06-01")).toMatchObject({
      current: 3,
      longest: 3,
      lastLoggedDate: "2026-06-01",
    });
  });

  it("treats 'today not yet logged but yesterday was' as a live streak from yesterday", () => {
    const txns = [
      txn("2026-05-31"),
      txn("2026-05-30"),
    ];
    expect(computeStreak(txns, "2026-06-01")).toMatchObject({
      current: 2,
      longest: 2,
      lastLoggedDate: "2026-05-31",
    });
  });

  it("returns current=0 when neither today nor yesterday is logged", () => {
    const txns = [
      txn("2026-05-25"),
      txn("2026-05-24"),
    ];
    expect(computeStreak(txns, "2026-06-01")).toMatchObject({
      current: 0,
      longest: 2,
    });
  });

  it("collapses multiple transactions on the same day into one logged day", () => {
    const txns = [
      txn("2026-06-01"),
      txn("2026-06-01"),
      txn("2026-06-01"),
      txn("2026-05-31"),
    ];
    expect(computeStreak(txns, "2026-06-01")).toMatchObject({ current: 2, longest: 2 });
  });

  it("computes the longest run independent of the current run", () => {
    const txns = [
      // Old run of 5
      txn("2026-01-01"),
      txn("2026-01-02"),
      txn("2026-01-03"),
      txn("2026-01-04"),
      txn("2026-01-05"),
      // Gap
      txn("2026-06-01"),
    ];
    expect(computeStreak(txns, "2026-06-01")).toMatchObject({ current: 1, longest: 5 });
  });

  it("respects the today parameter (frozen-time test)", () => {
    const txns = [txn("2024-12-31")];
    expect(computeStreak(txns, "2024-12-31")).toMatchObject({ current: 1, lastLoggedDate: "2024-12-31" });
    expect(computeStreak(txns, "2025-01-02")).toMatchObject({ current: 0, lastLoggedDate: "2024-12-31" });
  });

  it("handles month boundaries when walking back", () => {
    const txns = [
      txn("2026-06-01"),
      txn("2026-05-31"),
      txn("2026-05-30"),
      txn("2026-05-29"),
    ];
    expect(computeStreak(txns, "2026-06-01")).toMatchObject({ current: 4, longest: 4 });
  });

  it("handles year boundaries when walking back", () => {
    const txns = [
      txn("2026-01-01"),
      txn("2025-12-31"),
      txn("2025-12-30"),
    ];
    expect(computeStreak(txns, "2026-01-01")).toMatchObject({ current: 3, longest: 3 });
  });

  it("ignores deleted txns even when surrounded by logged days", () => {
    const txns = [
      txn("2026-06-01"),
      txn("2026-05-31", { isDeleted: true }),
      txn("2026-05-30"),
    ];
    // Streak from today = 1; then 2026-05-31 doesn't count → break.
    expect(computeStreak(txns, "2026-06-01")).toMatchObject({ current: 1, longest: 1 });
  });

  it("considers split-child and import sources as manual (any non-recurring)", () => {
    const txns = [
      txn("2026-06-01", { source: "split_child" }),
      txn("2026-05-31", { source: "import" }),
    ];
    expect(computeStreak(txns, "2026-06-01")).toMatchObject({ current: 2, longest: 2 });
  });
});

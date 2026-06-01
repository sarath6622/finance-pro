import { describe, expect, it } from "vitest";
import {
  InvalidReminderTimeError,
  msUntilNextFire,
  nextLocalFire,
  parseHhMm,
} from "./schedule";

describe("parseHhMm", () => {
  it.each(["00:00", "09:30", "13:05", "21:00", "23:59"])("parses %s", (s) => {
    expect(() => parseHhMm(s)).not.toThrow();
  });

  it.each([
    "24:00",
    "9:30",
    "21:60",
    "21",
    "21:0",
    "ab:cd",
    "",
    "21:00:00",
  ])("rejects %s", (s) => {
    expect(() => parseHhMm(s)).toThrow(InvalidReminderTimeError);
  });

  it("extracts hour and minute", () => {
    expect(parseHhMm("09:30")).toEqual({ hour: 9, minute: 30 });
    expect(parseHhMm("21:05")).toEqual({ hour: 21, minute: 5 });
  });
});

describe("nextLocalFire", () => {
  it("returns today at HH:MM when that is in the future", () => {
    const now = new Date("2026-06-01T10:00:00");
    const next = nextLocalFire(now, "21:00");
    expect(next.getHours()).toBe(21);
    expect(next.getMinutes()).toBe(0);
    expect(next.toDateString()).toBe(now.toDateString());
  });

  it("returns tomorrow at HH:MM when that time has already passed today", () => {
    const now = new Date("2026-06-01T22:00:00");
    const next = nextLocalFire(now, "21:00");
    expect(next.getHours()).toBe(21);
    expect(next.toDateString()).not.toBe(now.toDateString());
    expect(next.getTime() - now.getTime()).toBeGreaterThan(0);
  });

  it("returns tomorrow when now exactly equals the target (no double-fire on edge)", () => {
    const now = new Date("2026-06-01T21:00:00.000");
    const next = nextLocalFire(now, "21:00");
    expect(next.getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("crosses month boundaries cleanly", () => {
    const now = new Date("2026-06-30T22:00:00");
    const next = nextLocalFire(now, "07:00");
    expect(next.getMonth()).toBe(6); // July (0-indexed)
    expect(next.getDate()).toBe(1);
  });

  it("crosses year boundaries cleanly", () => {
    const now = new Date("2026-12-31T22:00:00");
    const next = nextLocalFire(now, "07:00");
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(0);
    expect(next.getDate()).toBe(1);
  });
});

describe("msUntilNextFire", () => {
  it("returns ms delta to the next fire (positive)", () => {
    const now = new Date("2026-06-01T20:30:00");
    expect(msUntilNextFire(now, "21:00")).toBe(30 * 60 * 1000);
  });

  it("returns a positive delta even when the time just passed", () => {
    const now = new Date("2026-06-01T21:00:00.001");
    expect(msUntilNextFire(now, "21:00")).toBeGreaterThan(0);
  });
});

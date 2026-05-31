import { describe, it, expect } from "vitest";
import { ageBucket } from "./aging";

describe("ageBucket", () => {
  it("E26 pay-when-able returns regardless of age", () => {
    expect(ageBucket("2024-01-01", "2026-05-30", "when_able")).toBe("pay-when-able");
    expect(ageBucket("2026-05-30", "2026-05-30", "when_able")).toBe("pay-when-able");
  });

  it("returns 0-30 for fresh loans", () => {
    expect(ageBucket("2026-05-01", "2026-05-30", "none")).toBe("0-30");
    expect(ageBucket("2026-05-30", "2026-05-30", "on_date")).toBe("0-30");
    expect(ageBucket("2026-04-30", "2026-05-30", "none")).toBe("0-30");
  });

  it("returns 30-90 at the boundary", () => {
    expect(ageBucket("2026-04-29", "2026-05-30", "none")).toBe("30-90");
    expect(ageBucket("2026-03-01", "2026-05-30", "none")).toBe("30-90");
  });

  it("returns 90+ beyond 90 days", () => {
    expect(ageBucket("2026-02-28", "2026-05-30", "none")).toBe("90+");
    expect(ageBucket("2025-01-01", "2026-05-30", "on_date")).toBe("90+");
  });

  it("accepts ISO datetimes (slices to date)", () => {
    expect(ageBucket("2026-05-01T18:00:00.000Z", "2026-05-30T05:00:00.000Z", "none")).toBe("0-30");
  });
});

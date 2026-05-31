import { describe, expect, it } from "vitest";
import { deriveBillStatus, deriveParticipantStatus } from "./derive-status";
import type { ParticipantLite } from "./types";

describe("deriveParticipantStatus", () => {
  it("returns open when nothing settled", () => {
    expect(deriveParticipantStatus(30000, 0)).toBe("open");
  });
  it("returns partial mid-way", () => {
    expect(deriveParticipantStatus(30000, 10000)).toBe("partial");
  });
  it("returns settled at exact match", () => {
    expect(deriveParticipantStatus(30000, 30000)).toBe("settled");
  });
  it("returns settled on overpayment too (caller filters advances elsewhere)", () => {
    expect(deriveParticipantStatus(30000, 40000)).toBe("settled");
  });
});

function p(
  cpId: string,
  share: number,
  settled: number,
  dueModel: ParticipantLite["dueModel"] = "when_able",
): ParticipantLite {
  return {
    counterpartyId: cpId,
    sharePaise: share,
    settledPaise: settled,
    status: deriveParticipantStatus(share, settled),
    dueModel,
  };
}

describe("deriveBillStatus", () => {
  it("open when none paid", () => {
    expect(deriveBillStatus([p("a", 30000, 0), p("b", 30000, 0)])).toBe("open");
  });
  it("partial when at least one in progress", () => {
    expect(deriveBillStatus([p("a", 30000, 10000), p("b", 30000, 0)])).toBe("partial");
  });
  it("partial when one fully paid and another not started", () => {
    expect(deriveBillStatus([p("a", 30000, 30000), p("b", 30000, 0)])).toBe("partial");
  });
  it("settled when every participant has full payment", () => {
    expect(deriveBillStatus([p("a", 30000, 30000), p("b", 30000, 30000)])).toBe("settled");
  });
  it("open for empty participants array (defensive)", () => {
    expect(deriveBillStatus([])).toBe("open");
  });
});

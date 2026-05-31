import { describe, expect, it } from "vitest";
import {
  ShareValidationError,
  equalShares,
  proposeEqualParticipants,
  turfShares,
  validateShares,
} from "./compute-shares";

describe("equalShares", () => {
  it("splits an even amount cleanly", () => {
    expect(equalShares(120000, 4)).toEqual([30000, 30000, 30000, 30000]);
  });
  it("distributes the paise remainder to early shares so the sum is exact", () => {
    expect(equalShares(100, 3)).toEqual([34, 33, 33]);
    expect(equalShares(100, 3).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("handles n=1", () => {
    expect(equalShares(12345, 1)).toEqual([12345]);
  });
  it("rejects n<=0", () => {
    expect(() => equalShares(100, 0)).toThrow(ShareValidationError);
  });
  it("rejects negative total", () => {
    expect(() => equalShares(-1, 3)).toThrow(ShareValidationError);
  });
});

describe("turfShares", () => {
  it("matches the ₹1500/player × 6 default", () => {
    const r = turfShares(150000, 6);
    expect(r.totalPaise).toBe(900000);
    expect(r.shares).toEqual([150000, 150000, 150000, 150000, 150000, 150000]);
  });
  it("preserves the exact rupee total for odd player counts", () => {
    const r = turfShares(150000, 7);
    expect(r.totalPaise).toBe(1050000);
    expect(r.shares.reduce((a, b) => a + b, 0)).toBe(1050000);
  });
  it("rejects zero unit cost", () => {
    expect(() => turfShares(0, 6)).toThrow(ShareValidationError);
  });
});

describe("validateShares", () => {
  it("accepts a valid breakdown", () => {
    expect(() =>
      validateShares(120000, 30000, [
        { counterpartyId: "a", sharePaise: 30000 },
        { counterpartyId: "b", sharePaise: 30000 },
        { counterpartyId: "c", sharePaise: 30000 },
      ]),
    ).not.toThrow();
  });
  it("rejects sum mismatch", () => {
    expect(() =>
      validateShares(120000, 30000, [
        { counterpartyId: "a", sharePaise: 30000 },
        { counterpartyId: "b", sharePaise: 30000 },
      ]),
    ).toThrow(ShareValidationError);
  });
  it("rejects ownShare > total", () => {
    expect(() =>
      validateShares(120000, 200000, [{ counterpartyId: "a", sharePaise: 0 }]),
    ).toThrow(/exceed/);
  });
  it("rejects empty participants list", () => {
    expect(() => validateShares(100, 100, [])).toThrow(ShareValidationError);
  });
  it("rejects negative share", () => {
    expect(() =>
      validateShares(120000, 30000, [
        { counterpartyId: "a", sharePaise: 30000 },
        { counterpartyId: "b", sharePaise: 30000 },
        { counterpartyId: "c", sharePaise: 30000 },
        { counterpartyId: "d", sharePaise: -1 },
      ]),
    ).toThrow(ShareValidationError);
  });
  it("rejects non-integer share", () => {
    expect(() =>
      validateShares(100, 25, [
        { counterpartyId: "a", sharePaise: 37.5 },
        { counterpartyId: "b", sharePaise: 37.5 },
      ]),
    ).toThrow(ShareValidationError);
  });
});

describe("proposeEqualParticipants", () => {
  it("includes owner in the equal split by default", () => {
    const { ownSharePaise, participants } = proposeEqualParticipants(120000, ["a", "b", "c"], {
      includeOwner: true,
    });
    expect(ownSharePaise).toBe(30000);
    expect(participants.map((p) => p.sharePaise)).toEqual([30000, 30000, 30000]);
  });
  it("excludes owner when includeOwner=false (rent reimbursement style)", () => {
    const { ownSharePaise, participants } = proposeEqualParticipants(150000, ["a", "b"], {
      includeOwner: false,
    });
    expect(ownSharePaise).toBe(0);
    expect(participants.map((p) => p.sharePaise)).toEqual([75000, 75000]);
  });
  it("propagates paise remainder so sum stays exact", () => {
    const { ownSharePaise, participants } = proposeEqualParticipants(100, ["a", "b"], {
      includeOwner: true,
    });
    const sum = ownSharePaise + participants.reduce((s, p) => s + p.sharePaise, 0);
    expect(sum).toBe(100);
  });
});

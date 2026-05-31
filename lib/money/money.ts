import { formatPaise, type FormatOptions } from "./format";

const PAISE_PER_RUPEE = 100;

export class Money {
  public readonly paise: number;
  private constructor(paise: number) {
    if (!Number.isInteger(paise)) {
      throw new Error(`Money requires integer paise, got ${paise}`);
    }
    if (!Number.isFinite(paise)) {
      throw new Error("Money paise must be finite");
    }
    this.paise = Object.is(paise, -0) ? 0 : paise;
  }

  static fromPaise(paise: number): Money {
    return new Money(paise);
  }

  static fromRupees(rupees: number | string): Money {
    if (typeof rupees === "number") {
      if (!Number.isFinite(rupees)) {
        throw new Error("Invalid rupee amount");
      }
      return Money.parse(rupees.toString());
    }
    return Money.parse(rupees);
  }

  static zero(): Money {
    return new Money(0);
  }

  static parse(input: string): Money {
    const cleaned = input.replace(/[₹\s,]/g, "").trim();
    if (cleaned === "" || cleaned === "-") {
      throw new Error(`Cannot parse Money from "${input}"`);
    }
    const sign = cleaned.startsWith("-") ? -1 : 1;
    const body = cleaned.replace(/^-/, "");
    if (!/^\d+(\.\d+)?$/.test(body)) {
      throw new Error(`Cannot parse Money from "${input}"`);
    }
    const [whole, frac = ""] = body.split(".");
    const paiseFromFrac = fractionalToPaise(frac);
    const paise = sign * (parseInt(whole!, 10) * PAISE_PER_RUPEE + paiseFromFrac);
    return new Money(paise);
  }

  add(other: Money): Money {
    return new Money(this.paise + other.paise);
  }

  sub(other: Money): Money {
    return new Money(this.paise - other.paise);
  }

  neg(): Money {
    return new Money(-this.paise);
  }

  abs(): Money {
    return new Money(Math.abs(this.paise));
  }

  mul(scalar: number): Money {
    if (!Number.isInteger(scalar)) {
      throw new Error("Money.mul requires integer scalar; use mulRate for decimals");
    }
    return new Money(this.paise * scalar);
  }

  mulRate(rate: number): Money {
    if (!Number.isFinite(rate)) {
      throw new Error("Invalid rate");
    }
    return new Money(roundHalfEven(this.paise * rate));
  }

  divInt(divisor: number): { quotient: Money; remainderPaise: number } {
    if (!Number.isInteger(divisor) || divisor === 0) {
      throw new Error("Money.divInt requires non-zero integer divisor");
    }
    const q = Math.trunc(this.paise / divisor);
    const r = this.paise - q * divisor;
    return { quotient: new Money(q), remainderPaise: r };
  }

  splitEqually(parts: number): Money[] {
    if (!Number.isInteger(parts) || parts <= 0) {
      throw new Error("splitEqually requires positive integer parts");
    }
    const baseQ = Math.trunc(this.paise / parts);
    const remainder = this.paise - baseQ * parts;
    const sign = remainder >= 0 ? 1 : -1;
    let r = Math.abs(remainder);
    const out: Money[] = [];
    for (let i = 0; i < parts; i++) {
      const extra = r > 0 ? sign : 0;
      out.push(new Money(baseQ + extra));
      if (r > 0) r--;
    }
    return out;
  }

  splitByShares(shares: number[]): Money[] {
    if (shares.length === 0) {
      throw new Error("shares cannot be empty");
    }
    if (shares.some((s) => !Number.isInteger(s) || s < 0)) {
      throw new Error("shares must be non-negative integers");
    }
    const total = shares.reduce((a, b) => a + b, 0);
    if (total === 0) {
      throw new Error("total of shares must be > 0");
    }
    const raw = shares.map((s) => (this.paise * s) / total);
    const floors = raw.map((r) => Math.trunc(r));
    const allocated = floors.reduce((a, b) => a + b, 0);
    let remainder = this.paise - allocated;
    const fracsSigned = raw.map((r, i) => ({ frac: r - floors[i]!, i }));
    fracsSigned.sort((a, b) => Math.abs(b.frac) - Math.abs(a.frac));
    const out = floors.slice();
    let k = 0;
    while (remainder !== 0) {
      const idx = fracsSigned[k % fracsSigned.length]!.i;
      const step = remainder > 0 ? 1 : -1;
      out[idx] = (out[idx] ?? 0) + step;
      remainder -= step;
      k++;
    }
    return out.map((p) => new Money(p));
  }

  eq(other: Money): boolean {
    return this.paise === other.paise;
  }
  lt(other: Money): boolean {
    return this.paise < other.paise;
  }
  lte(other: Money): boolean {
    return this.paise <= other.paise;
  }
  gt(other: Money): boolean {
    return this.paise > other.paise;
  }
  gte(other: Money): boolean {
    return this.paise >= other.paise;
  }
  isZero(): boolean {
    return this.paise === 0;
  }
  isPositive(): boolean {
    return this.paise > 0;
  }
  isNegative(): boolean {
    return this.paise < 0;
  }

  toJSON(): number {
    return this.paise;
  }
  toString(): string {
    return this.format();
  }
  format(opts?: FormatOptions): string {
    return formatPaise(this.paise, opts);
  }
}

function fractionalToPaise(frac: string): number {
  if (frac.length === 0) return 0;
  if (frac.length <= 2) {
    return parseInt(frac.padEnd(2, "0"), 10);
  }
  const head = frac.slice(0, 2);
  const tail = frac.slice(2);
  const headNum = parseInt(head, 10);
  const tailFirst = parseInt(tail[0]!, 10);
  const tailRest = tail.slice(1);
  let roundUp: boolean;
  if (tailFirst > 5) {
    roundUp = true;
  } else if (tailFirst < 5) {
    roundUp = false;
  } else {
    const hasMoreNonZero = /[1-9]/.test(tailRest);
    roundUp = hasMoreNonZero ? true : headNum % 2 === 1;
  }
  return headNum + (roundUp ? 1 : 0);
}

function roundHalfEven(n: number): number {
  const floor = Math.floor(n);
  const diff = n - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

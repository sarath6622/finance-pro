import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plain, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  }).toString("hex");
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt}:${derived}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  // Accept both new (":") and legacy ("$") separators so existing hashes still work.
  const sep = stored.startsWith("scrypt:") ? ":" : "$";
  const parts = stored.split(sep);
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nStr, rStr, pStr, salt, hashHex] = parts;
  const N = parseInt(nStr!, 10);
  const r = parseInt(rStr!, 10);
  const p = parseInt(pStr!, 10);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  const expected = Buffer.from(hashHex!, "hex");
  const got = scryptSync(plain, salt!, expected.length, { N, r, p });
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}

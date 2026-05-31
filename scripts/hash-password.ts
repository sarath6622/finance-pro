/**
 * Hash a password for OWNER_PASSWORD_HASH in .env.local.
 * Usage: npm run hash-password -- <plain-password>
 */
import { hashPassword } from "../lib/auth/password";

const plain = process.argv[2];
if (!plain) {
  console.error("usage: npm run hash-password -- <plain-password>");
  process.exit(1);
}
console.log(hashPassword(plain));

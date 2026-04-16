import { randomBytes } from "crypto";

// 54 chars; deliberately excludes visually ambiguous: 0 (zero), O (capital o),
// I (capital i), l (lowercase L), 1 (one).
// Per CONTEXT.md D-10 "unambiguous" requirement.
// Per RESEARCH.md Pattern 4: D-10's `crypto.randomBytes(5).toString('base64url')`
// is BUGGY — it produces 7 chars and includes 0/O/l/1. Do not use that formula.
export const UNAMBIGUOUS_ALPHABET =
  "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generateHouseholdSlug(length = 8): string {
  const alphabet = UNAMBIGUOUS_ALPHABET;
  // Rejection sampling cutoff to remove modulo bias.
  // floor(256 / 54) * 54 = 216. Bytes >= 216 are discarded.
  const maxValid = Math.floor(256 / alphabet.length) * alphabet.length;

  let result = "";
  while (result.length < length) {
    // Oversample to minimize loop iterations.
    const bytes = randomBytes((length - result.length) * 2);
    for (let i = 0; i < bytes.length && result.length < length; i++) {
      const b = bytes[i];
      if (b < maxValid) {
        result += alphabet[b % alphabet.length];
      }
    }
  }
  return result;
}

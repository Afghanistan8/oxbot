import { randomBytes, randomInt } from "crypto";

/**
 * Entry-code utilities.
 *
 * Codes are human-friendly (uppercase, ambiguous characters removed) and
 * generated with a CSPRNG. Used by the founder "generate codes" flow + seed.
 */

// Excludes easily-confused characters (0/O, 1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Generate a single random code of `length` chars using a CSPRNG. */
export function generateCode(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

/** Generate a code with an optional prefix, e.g. "OX-7K3M9Q2P". */
export function generatePrefixedCode(prefix?: string, length = 8): string {
  const body = generateCode(length);
  return prefix ? `${prefix.toUpperCase()}-${body}` : body;
}

/**
 * Generate `count` unique codes. Uniqueness is guaranteed within the batch;
 * callers should still rely on the DB unique constraint for cross-batch safety.
 */
export function generateUniqueCodes(
  count: number,
  opts: { length?: number; prefix?: string } = {}
): string[] {
  const { length = 8, prefix } = opts;
  const set = new Set<string>();
  // Guard against impossible requests (more codes than the space allows).
  const maxAttempts = count * 20 + 100;
  let attempts = 0;
  while (set.size < count && attempts < maxAttempts) {
    set.add(generatePrefixedCode(prefix, length));
    attempts++;
  }
  return Array.from(set);
}

/** Normalize a user-submitted code for comparison (unless case-sensitive). */
export function normalizeCode(code: string, caseSensitive = false): string {
  const trimmed = code.trim();
  return caseSensitive ? trimmed : trimmed.toUpperCase();
}

/** A short opaque token for links/invites (URL-safe). */
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

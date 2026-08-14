import "server-only";

/**
 * In-memory rate limiter (token-bucket-ish fixed window).
 *
 * Suitable for a single-instance deployment and dev. The interface is
 * intentionally Redis-shaped (`limit(key, ...)`) so it can be swapped for a
 * distributed store in Phase 2 without touching call sites.
 *
 * NOTE: state lives in module scope. Next.js may spin multiple workers, so this
 * is a best-effort guard, not a hard security boundary — the important
 * invariants (one entry per user, atomic FCFS/codes) are enforced in the DB.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so the map doesn't grow unbounded.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  success: boolean;
  /** Remaining requests in the current window. */
  remaining: number;
  /** Epoch ms when the window resets. */
  resetAt: number;
  /** Seconds until reset (convenience for Retry-After). */
  retryAfter: number;
};

/**
 * Consume one token for `key`. Allows up to `limit` requests per `windowMs`.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt, retryAfter: 0 };
  }

  if (existing.count >= limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    success: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
    retryAfter: 0,
  };
}

/** Common presets used across actions/routes. */
export const RATE_LIMITS = {
  /** Entry submissions: 10 per minute per user. */
  entry: { limit: 10, windowMs: 60_000 },
  /** Requirement re-checks (calls out to X/Discord): 20 per minute per user. */
  verify: { limit: 20, windowMs: 60_000 },
  /** Team/giveaway mutations: 30 per minute per user. */
  mutate: { limit: 30, windowMs: 60_000 },
  /** Auth email requests: 5 per 5 minutes per identifier. */
  authEmail: { limit: 5, windowMs: 5 * 60_000 },
} as const;

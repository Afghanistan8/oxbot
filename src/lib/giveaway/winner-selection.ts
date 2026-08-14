import { createHmac, randomBytes } from "crypto";

import type { GiveawayType, WinnerMethod } from "@prisma/client";

/**
 * Winner selection — provably-fair, reproducible draws.
 *
 * This module is intentionally PURE: no database, no network, no clock. Given
 * the same eligible entries + count + seed, it always returns the same winners,
 * so a draw can be independently reproduced and audited from the stored seed.
 *
 *  - RANDOM (and CODE): the eligible set is sorted by a stable key (entryId),
 *    then shuffled with a CSPRNG-seeded PRNG (HMAC-SHA256 in counter mode). The
 *    seed is generated with `crypto.randomBytes` and stored on the giveaway.
 *  - FCFS: no randomness — winners are the earliest completed entries by their
 *    atomically-assigned `seq`.
 *
 * The eligibility filtering (COMPLETED status, Discord re-checks) and all DB
 * writes live in the server action; this file only decides the ordering.
 */

/** An entry eligible to win, reduced to what selection needs. */
export type SelectableEntry = {
  entryId: string;
  userId: string;
  /** FCFS ordinal; assigned on completion. Null only for malformed data. */
  seq: number | null;
};

/** A chosen winner with its 1-based rank. */
export type SelectedWinner = {
  entryId: string;
  userId: string;
  rank: number;
};

/** Generate a fresh, high-entropy draw seed (256 bits, hex-encoded). */
export function generateDrawSeed(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Build a deterministic PRNG from a seed. Each call yields a float in [0, 1)
 * derived from HMAC-SHA256(seed, counter) — a standard, reproducible construction.
 */
export function makeSeededRng(seed: string): () => number {
  let counter = 0;
  return () => {
    const digest = createHmac("sha256", seed).update(String(counter++)).digest();
    // 48 bits of entropy → uniform-enough float in [0, 1).
    const int = digest.readUIntBE(0, 6);
    return int / 2 ** 48;
  };
}

/**
 * Fisher-Yates shuffle driven by a seeded RNG. Returns a new array; the input
 * is not mutated. Index accesses are provably in-bounds (j ≤ i < length).
 */
export function seededShuffle<T>(items: readonly T[], rng: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = arr[i]!;
    const b = arr[j]!;
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}

/** Stable FCFS comparator: by seq ascending (nulls last), then entryId. */
function fcfsCompare(a: SelectableEntry, b: SelectableEntry): number {
  const as = a.seq ?? Number.POSITIVE_INFINITY;
  const bs = b.seq ?? Number.POSITIVE_INFINITY;
  if (as !== bs) return as - bs;
  return a.entryId < b.entryId ? -1 : a.entryId > b.entryId ? 1 : 0;
}

/** The winner method implied by a giveaway type. */
export function winnerMethodFor(type: GiveawayType): WinnerMethod {
  return type === "FCFS" ? "FCFS" : "RANDOM";
}

/**
 * Choose up to `count` winners from `entries`.
 *
 * FCFS is deterministic by `seq`. RANDOM/CODE first sort by `entryId` (so the
 * base ordering never depends on DB row order) then apply a seed-derived
 * shuffle — making the result reproducible from `seed` alone.
 */
export function selectWinners(
  entries: readonly SelectableEntry[],
  count: number,
  opts: { type: GiveawayType; seed: string }
): SelectedWinner[] {
  const take = Math.max(0, Math.min(count, entries.length));
  if (take === 0) return [];

  let ordered: SelectableEntry[];
  if (opts.type === "FCFS") {
    ordered = entries.slice().sort(fcfsCompare);
  } else {
    const base = entries
      .slice()
      .sort((a, b) => (a.entryId < b.entryId ? -1 : a.entryId > b.entryId ? 1 : 0));
    ordered = seededShuffle(base, makeSeededRng(opts.seed));
  }

  return ordered.slice(0, take).map((e, i) => ({
    entryId: e.entryId,
    userId: e.userId,
    rank: i + 1,
  }));
}

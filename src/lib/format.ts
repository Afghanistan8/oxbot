import type { GiveawayStatus, GiveawayType } from "@prisma/client";

/**
 * Date / time formatting + giveaway timing helpers.
 */

/**
 * FCFS giveaways have no author-set end time — they close automatically once
 * every slot is claimed. The schema still needs a non-null `endAt`, so FCFS
 * rows store this far-future sentinel and the slot count is the real close
 * condition (see {@link isFcfsFull}).
 */
export const FCFS_SENTINEL_END_AT = new Date("2099-12-31T23:59:59.000Z");

type FcfsFillInput = {
  type?: GiveawayType | null;
  winnersCount?: number | null;
  /** Completed FCFS claims so far (the giveaway's `fcfsCursor`). */
  fcfsCursor?: number | null;
};

/** True when an FCFS giveaway has had all of its slots claimed. */
export function isFcfsFull(g: FcfsFillInput): boolean {
  if (g.type !== "FCFS") return false;
  const slots = g.winnersCount ?? 0;
  return slots > 0 && (g.fcfsCursor ?? 0) >= slots;
}

/**
 * Format a date for display (e.g. "Aug 12, 2026, 3:40 PM").
 *
 * With no `timeZone` the runtime's zone is used — which is the viewer's local
 * zone on the client, but UTC on the server. Pass an explicit `timeZone`
 * (e.g. "UTC") when a deterministic, environment-independent result is needed,
 * such as the SSR/hydration pass behind <LocalTime>.
 */
export function formatDateTime(date: Date | string, timeZone?: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(d);
}

/** Format just the date (e.g. "Aug 12, 2026"). See {@link formatDateTime} re: `timeZone`. */
export function formatDate(date: Date | string, timeZone?: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    ...(timeZone ? { timeZone } : {}),
  }).format(d);
}

export type TimeParts = {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

/** Break a millisecond duration into d/h/m/s parts (clamped at zero). */
export function msToParts(ms: number): TimeParts {
  const total = Math.max(0, ms);
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  return { total, days, hours, minutes, seconds };
}

/** Compact human duration, e.g. "5d 3h" or "2h 14m". */
export function humanizeMs(ms: number): string {
  const { days, hours, minutes } = msToParts(ms);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * The *effective* lifecycle phase of a giveaway based on its stored status and
 * the current time. Persisted status can lag (e.g. still ACTIVE past endAt) so
 * we compute the display phase from dates too.
 */
export type GiveawayPhase = "upcoming" | "live" | "ended" | "finalized" | "draft" | "cancelled";

/**
 * Minimal shape needed to compute a phase. FCFS fields are optional: pass them
 * (type + winnersCount + fcfsCursor) to have an FCFS giveaway close as soon as
 * every slot is claimed rather than waiting on a clock.
 */
export type PhaseInput = {
  status: GiveawayStatus;
  startAt: Date | string;
  endAt: Date | string;
} & FcfsFillInput;

export function giveawayPhase(g: PhaseInput, now: Date = new Date()): GiveawayPhase {
  if (g.status === "DRAFT") return "draft";
  if (g.status === "CANCELLED") return "cancelled";
  if (g.status === "FINALIZED") return "finalized";
  const start = new Date(g.startAt).getTime();
  const end = new Date(g.endAt).getTime();
  const t = now.getTime();
  if (t < start) return "upcoming";
  // FCFS closes the moment all slots are claimed, independent of the clock.
  if (isFcfsFull(g)) return "ended";
  if (t > end) return "ended";
  return "live";
}

/** Is the giveaway currently accepting entries? */
export function isAcceptingEntries(g: PhaseInput, now: Date = new Date()): boolean {
  const phase = giveawayPhase(g, now);
  return phase === "live";
}

export const PHASE_META: Record<
  GiveawayPhase,
  { label: string; badge: "live" | "gold" | "muted" | "success" | "warn" | "danger" }
> = {
  live: { label: "Live", badge: "live" },
  upcoming: { label: "Upcoming", badge: "warn" },
  ended: { label: "Ended", badge: "muted" },
  finalized: { label: "Winners drawn", badge: "gold" },
  draft: { label: "Draft", badge: "muted" },
  cancelled: { label: "Cancelled", badge: "danger" },
};

/** Map a stored status to a human label (for dashboards). */
export function statusLabel(status: GiveawayStatus): string {
  return {
    DRAFT: "Draft",
    SCHEDULED: "Scheduled",
    ACTIVE: "Active",
    ENDED: "Ended",
    FINALIZED: "Finalized",
    CANCELLED: "Cancelled",
  }[status];
}

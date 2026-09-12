import type {
  AllocationStatus,
  AssetType,
  DistributionMethod,
  ListingStatus,
  RequestStatus,
} from "@prisma/client";

import type { BadgeProps } from "@/components/ui/badge";

/**
 * OxFoxes Collab display metadata + pure inventory math. Client-safe — shared
 * by forms, cards, dashboards and the server actions.
 */

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

export const DISTRIBUTION_METHODS: DistributionMethod[] = ["FCFS", "CRITERIA", "RAFFLE", "MANUAL"];

export const METHOD_META: Record<DistributionMethod, { label: string; short: string; blurb: string }> = {
  FCFS: {
    label: "First come, first served",
    short: "FCFS",
    blurb: "The first qualified requests are approved instantly until spots run out.",
  },
  CRITERIA: {
    label: "Criteria review",
    short: "Criteria",
    blurb: "Requesters must meet your thresholds. Qualified requests land in your review queue.",
  },
  RAFFLE: {
    label: "Partner raffle",
    short: "Raffle",
    blurb: "Qualified requester teams are drawn with a seeded CSPRNG when the window closes.",
  },
  MANUAL: {
    label: "Manual",
    short: "Manual",
    blurb: "Every request comes to you. Pick partners and set spots by hand.",
  },
};

export const ASSET_TYPES: AssetType[] = ["NFT", "TOKEN", "OTHER"];

export const ASSET_TYPE_META: Record<AssetType, { label: string }> = {
  NFT: { label: "NFT" },
  TOKEN: { label: "Token" },
  OTHER: { label: "Other" },
};

export const LISTING_STATUS_META: Record<ListingStatus, { label: string; badge: BadgeVariant }> = {
  DRAFT: { label: "Draft", badge: "muted" },
  OPEN: { label: "Open", badge: "live" },
  PAUSED: { label: "Paused", badge: "warn" },
  ALLOCATED: { label: "Fully allocated", badge: "gold" },
  CLOSED: { label: "Closed", badge: "muted" },
  CANCELLED: { label: "Cancelled", badge: "danger" },
};

export const REQUEST_STATUS_META: Record<RequestStatus, { label: string; badge: BadgeVariant }> = {
  DRAFT: { label: "Draft", badge: "muted" },
  SUBMITTED: { label: "Submitted", badge: "default" },
  UNDER_REVIEW: { label: "Under review", badge: "warn" },
  NEEDS_INFO: { label: "Needs info", badge: "warn" },
  APPROVED: { label: "Approved", badge: "success" },
  PARTIALLY_APPROVED: { label: "Partially approved", badge: "success" },
  REJECTED: { label: "Rejected", badge: "danger" },
  WAITLISTED: { label: "Waitlisted", badge: "muted" },
  CANCELLED: { label: "Cancelled", badge: "muted" },
  EXPIRED: { label: "Expired", badge: "muted" },
};

export const ALLOCATION_STATUS_META: Record<AllocationStatus, { label: string; badge: BadgeVariant; blurb: string }> = {
  RESERVED: { label: "Reserved", badge: "warn", blurb: "Granted — waiting on delivery wallets." },
  CONFIRMED: { label: "Confirmed", badge: "default", blurb: "Wallets confirmed — ready to add to the whitelist." },
  DELIVERED: { label: "Delivered", badge: "success", blurb: "Added to the whitelist." },
  REVOKED: { label: "Revoked", badge: "danger", blurb: "Spots returned to inventory." },
};

/** Requests still waiting on a decision — they can be approved / rejected. */
export const OPEN_REQUEST_STATUSES: RequestStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_INFO",
  "WAITLISTED",
];

/** Requests that block the same team from filing another on the same listing. */
export const ACTIVE_REQUEST_STATUSES: RequestStatus[] = [
  ...OPEN_REQUEST_STATUSES,
  "APPROVED",
  "PARTIALLY_APPROVED",
];

/** Listing statuses that are browsable on the public desk. */
export const PUBLIC_LISTING_STATUSES: ListingStatus[] = ["OPEN", "PAUSED", "ALLOCATED", "CLOSED"];

// --- Inventory math ----------------------------------------------------------

export type InventoryCounts = {
  totalSpots: number;
  reservedSpots: number;
  allocatedSpots: number;
  publicSpots: number;
};

/** Partner spots still free: total − reserved − allocated − public. Never negative. */
export function availableSpots(l: InventoryCounts): number {
  return Math.max(0, l.totalSpots - l.reservedSpots - l.allocatedSpots - l.publicSpots);
}

/** Partner-facing capacity (everything except the public raffle slice). */
export function partnerCapacity(l: InventoryCounts): number {
  return Math.max(0, l.totalSpots - l.publicSpots);
}

/**
 * The effective phase of a listing for display. Stored status can lag the
 * clock (OPEN past `endAt`), so the window is applied on top.
 */
export type ListingPhase = "draft" | "upcoming" | "open" | "paused" | "allocated" | "closed" | "cancelled";

export function listingPhase(
  l: { status: ListingStatus; startAt: Date | string; endAt: Date | string } & InventoryCounts,
  now: Date = new Date()
): ListingPhase {
  switch (l.status) {
    case "DRAFT":
      return "draft";
    case "CANCELLED":
      return "cancelled";
    case "CLOSED":
      return "closed";
    case "PAUSED":
      return "paused";
  }
  const t = now.getTime();
  if (t > new Date(l.endAt).getTime()) return "closed";
  if (l.status === "ALLOCATED" || availableSpots(l) === 0) return "allocated";
  if (t < new Date(l.startAt).getTime()) return "upcoming";
  return "open";
}

export const LISTING_PHASE_META: Record<ListingPhase, { label: string; badge: BadgeVariant }> = {
  draft: { label: "Draft", badge: "muted" },
  upcoming: { label: "Opens soon", badge: "warn" },
  open: { label: "Open", badge: "live" },
  paused: { label: "Paused", badge: "warn" },
  allocated: { label: "Fully allocated", badge: "gold" },
  closed: { label: "Closed", badge: "muted" },
  cancelled: { label: "Cancelled", badge: "danger" },
};

/** Is a listing currently accepting partner requests? */
export function isAcceptingRequests(
  l: Parameters<typeof listingPhase>[0],
  now: Date = new Date()
): boolean {
  return listingPhase(l, now) === "open";
}

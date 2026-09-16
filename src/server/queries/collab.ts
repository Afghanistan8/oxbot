import "server-only";

import { db } from "@/lib/db";
import { OPEN_REQUEST_STATUSES, availableSpots } from "@/lib/collab/constants";
import type {
  AllocationStatus,
  AssetType,
  Blockchain,
  ContactMethod,
  GiveawayVisibility,
  ListingStatus,
  RequestStatus,
} from "@prisma/client";

/**
 * Team-scoped OxFoxes Collab queries for the dashboard. PRIVATE: these expose
 * requester contact details, stats, wallets and private notes — callers MUST
 * verify membership first (resolveTeamPage / requireTeamRole / requireTeamBySlug).
 */

export type DashboardListing = {
  id: string;
  slug: string;
  title: string;
  bannerUrl: string | null;
  assetType: AssetType;
  chain: Blockchain;
  collectionName: string | null;
  tokenSymbol: string | null;
  status: ListingStatus;
  visibility: GiveawayVisibility;
  startAt: Date;
  endAt: Date;
  totalSpots: number;
  reservedSpots: number;
  allocatedSpots: number;
  available: number;
  requestCount: number;
  openRequestCount: number;
  createdAt: Date;
};

const listingSelect = {
  id: true,
  slug: true,
  title: true,
  bannerUrl: true,
  assetType: true,
  chain: true,
  collectionName: true,
  tokenSymbol: true,
  status: true,
  visibility: true,
  startAt: true,
  endAt: true,
  totalSpots: true,
  reservedSpots: true,
  allocatedSpots: true,
  createdAt: true,
  _count: { select: { requests: true } },
} as const;

async function openRequestCounts(listingIds: string[]): Promise<Map<string, number>> {
  if (listingIds.length === 0) return new Map();
  const grouped = await db.collabRequest.groupBy({
    by: ["listingId"],
    where: { listingId: { in: listingIds }, status: { in: OPEN_REQUEST_STATUSES } },
    _count: { _all: true },
  });
  return new Map(grouped.map((g) => [g.listingId, g._count._all]));
}

/** Every listing a team owns, newest first. */
export async function getTeamListings(teamId: string): Promise<DashboardListing[]> {
  const rows = await db.whitelistListing.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    select: listingSelect,
  });
  const open = await openRequestCounts(rows.map((r) => r.id));
  return rows.map(({ _count, ...r }) => ({
    ...r,
    available: availableSpots(r),
    requestCount: _count.requests,
    openRequestCount: open.get(r.id) ?? 0,
  }));
}

export type ManagedListing = DashboardListing & {
  teamId: string;
  description: string | null;
  collectionAddress: string | null;
  tokenAddress: string | null;
  mintOrTgeAt: Date | null;
  spotsPerRequestMin: number;
  spotsPerRequestMax: number;
  hideRequestCount: boolean;
  notesPrivate: string | null;
  requestStatusCounts: Partial<Record<RequestStatus, number>>;
  allocationCounts: Partial<Record<AllocationStatus, { count: number; spots: number }>>;
};

/** One listing scoped to its team (null if it belongs to someone else). */
export async function getManagedListing(teamId: string, listingId: string): Promise<ManagedListing | null> {
  const row = await db.whitelistListing.findFirst({
    where: { id: listingId, teamId },
    select: {
      ...listingSelect,
      teamId: true,
      description: true,
      collectionAddress: true,
      tokenAddress: true,
      mintOrTgeAt: true,
      spotsPerRequestMin: true,
      spotsPerRequestMax: true,
      hideRequestCount: true,
      notesPrivate: true,
    },
  });
  if (!row) return null;

  const [byStatus, allocations] = await Promise.all([
    db.collabRequest.groupBy({ by: ["status"], where: { listingId }, _count: { _all: true } }),
    db.collabAllocation.groupBy({ by: ["status"], where: { listingId }, _count: { _all: true }, _sum: { spots: true } }),
  ]);

  const { _count, ...rest } = row;
  const requestStatusCounts: ManagedListing["requestStatusCounts"] = {};
  for (const g of byStatus) requestStatusCounts[g.status] = g._count._all;
  const allocationCounts: ManagedListing["allocationCounts"] = {};
  for (const g of allocations) allocationCounts[g.status] = { count: g._count._all, spots: g._sum.spots ?? 0 };

  return {
    ...rest,
    available: availableSpots(rest),
    requestCount: _count.requests,
    openRequestCount: OPEN_REQUEST_STATUSES.reduce((n, s) => n + (requestStatusCounts[s] ?? 0), 0),
    requestStatusCounts,
    allocationCounts,
  };
}

export type CollabOverview = {
  listings: { open: number; total: number };
  spots: { total: number; available: number; granted: number };
  incoming: { open: number; total: number };
  outgoing: { open: number; approvedSpots: number };
};

/** Headline numbers for `/dashboard/[team]/collab`. */
export async function getCollabOverview(teamId: string): Promise<CollabOverview> {
  const [listings, incomingOpen, incomingTotal, outgoingOpen, outgoingGranted] = await Promise.all([
    db.whitelistListing.findMany({
      where: { teamId, status: { not: "CANCELLED" } },
      select: {
        status: true,
        totalSpots: true,
        reservedSpots: true,
        allocatedSpots: true,
      },
    }),
    db.collabRequest.count({ where: { listing: { teamId }, status: { in: OPEN_REQUEST_STATUSES } } }),
    db.collabRequest.count({ where: { listing: { teamId } } }),
    db.collabRequest.count({ where: { requesterTeamId: teamId, status: { in: OPEN_REQUEST_STATUSES } } }),
    db.collabAllocation.aggregate({
      where: { teamId, status: { not: "REVOKED" } },
      _sum: { spots: true },
    }),
  ]);

  return {
    listings: {
      open: listings.filter((l) => l.status === "OPEN" || l.status === "ALLOCATED").length,
      total: listings.length,
    },
    spots: {
      total: listings.reduce((n, l) => n + l.totalSpots, 0),
      available: listings
        .filter((l) => l.status === "OPEN")
        .reduce((n, l) => n + availableSpots(l), 0),
      granted: listings.reduce((n, l) => n + l.reservedSpots + l.allocatedSpots, 0),
    },
    incoming: { open: incomingOpen, total: incomingTotal },
    outgoing: { open: outgoingOpen, approvedSpots: outgoingGranted._sum.spots ?? 0 },
  };
}

// ---------------------------------------------------------------------------
// Requests: incoming (listing team) + outgoing (requester team)
// ---------------------------------------------------------------------------

export type IncomingFilter = "open" | "approved" | "closed" | "all";

const FILTER_STATUSES: Record<IncomingFilter, RequestStatus[] | null> = {
  open: OPEN_REQUEST_STATUSES,
  approved: ["APPROVED", "PARTIALLY_APPROVED"],
  closed: ["REJECTED", "CANCELLED", "EXPIRED"],
  all: null,
};

export type IncomingRequestRow = {
  id: string;
  status: RequestStatus;
  spotsRequested: number;
  spotsGranted: number | null;
  communityName: string;
  communitySize: number;
  createdAt: Date;
  requesterTeam: { name: string; slug: string; logoUrl: string | null } | null;
  addedByAdmin: { name: string | null; email: string | null } | null;
  listing: { id: string; title: string };
};

/** Requests against a team's listings, newest first (optionally one listing). */
export async function getIncomingRequests(
  teamId: string,
  opts: { filter?: IncomingFilter; listingId?: string } = {}
): Promise<IncomingRequestRow[]> {
  const statuses = FILTER_STATUSES[opts.filter ?? "open"];
  return db.collabRequest.findMany({
    where: {
      listing: { teamId, ...(opts.listingId ? { id: opts.listingId } : {}) },
      ...(statuses ? { status: { in: statuses } } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      status: true,
      spotsRequested: true,
      spotsGranted: true,
      communityName: true,
      communitySize: true,
      createdAt: true,
      requesterTeam: { select: { name: true, slug: true, logoUrl: true } },
      addedByAdmin: { select: { name: true, email: true } },
      listing: { select: { id: true, title: true } },
    },
  });
}

/** One incoming request with everything the review desk shows. */
export async function getIncomingRequest(teamId: string, requestId: string) {
  const r = await db.collabRequest.findFirst({
    where: { id: requestId, listing: { teamId } },
    include: {
      requesterTeam: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          description: true,
          xHandle: true,
          discordInvite: true,
          website: true,
          chains: true,
        },
      },
      submittedBy: { select: { name: true, email: true } },
      addedByAdmin: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true, email: true } },
      allocation: true,
      listing: {
        select: {
          id: true,
          slug: true,
          title: true,
          chain: true,
          status: true,
          totalSpots: true,
          reservedSpots: true,
          allocatedSpots: true,
          spotsPerRequestMin: true,
          spotsPerRequestMax: true,
        },
      },
    },
  });
  if (!r) return null;
  return {
    ...r,
    listing: { ...r.listing, available: availableSpots(r.listing) },
    allocationWallets: parseWallets(r.allocation?.wallets),
  };
}

export type IncomingRequestDetail = NonNullable<Awaited<ReturnType<typeof getIncomingRequest>>>;

export type AllocationWallet = { address: string; chain: Blockchain; label: string };

export function parseWallets(raw: unknown): AllocationWallet[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((w) => {
    if (!w || typeof w !== "object") return [];
    const { address, chain, label } = w as Record<string, unknown>;
    return typeof address === "string"
      ? [
          {
            address,
            chain: (typeof chain === "string" ? chain : "OTHER") as Blockchain,
            label: typeof label === "string" ? label : "",
          },
        ]
      : [];
  });
}

export type OutgoingRequestRow = {
  id: string;
  status: RequestStatus;
  spotsRequested: number;
  spotsGranted: number | null;
  reviewerNote: string | null;
  requesterReply: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  listing: {
    id: string;
    slug: string;
    title: string;
    chain: Blockchain;
    assetType: AssetType;
    mintOrTgeAt: Date | null;
    status: ListingStatus;
    team: { name: string; slug: string; logoUrl: string | null; xHandle: string | null; discordInvite: string | null };
  };
  allocation: {
    id: string;
    status: AllocationStatus;
    spots: number;
    wallets: AllocationWallet[];
    raffleUrl: string | null;
    proofImageUrl: string | null;
    reviewNote: string | null;
    reviewedAt: Date | null;
    submittedAt: Date | null;
    confirmedAt: Date | null;
    deliveredAt: Date | null;
  } | null;
};

/** Requests a team has filed on other projects' listings. */
export async function getOutgoingRequests(teamId: string): Promise<OutgoingRequestRow[]> {
  const rows = await db.collabRequest.findMany({
    where: { requesterTeamId: teamId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      spotsRequested: true,
      spotsGranted: true,
      reviewerNote: true,
      requesterReply: true,
      createdAt: true,
      reviewedAt: true,
      listing: {
        select: {
          id: true,
          slug: true,
          title: true,
          chain: true,
          assetType: true,
          mintOrTgeAt: true,
          status: true,
          team: { select: { name: true, slug: true, logoUrl: true, xHandle: true, discordInvite: true } },
        },
      },
      allocation: {
        select: {
          id: true,
          status: true,
          spots: true,
          wallets: true,
          raffleUrl: true,
          proofImageUrl: true,
          reviewNote: true,
          reviewedAt: true,
          submittedAt: true,
          confirmedAt: true,
          deliveredAt: true,
        },
      },
    },
  });
  return rows.map((r) => ({
    ...r,
    allocation: r.allocation ? { ...r.allocation, wallets: parseWallets(r.allocation.wallets) } : null,
  }));
}

// ---------------------------------------------------------------------------
// Allocations (listing team) + CSV export rows
// ---------------------------------------------------------------------------

export type AllocationRow = {
  id: string;
  status: AllocationStatus;
  spots: number;
  wallets: AllocationWallet[];
  note: string | null;
  raffleUrl: string | null;
  proofImageUrl: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  submittedAt: Date | null;
  createdAt: Date;
  confirmedAt: Date | null;
  deliveredAt: Date | null;
  team: { name: string; slug: string; xHandle: string | null; discordInvite: string | null } | null;
  listing: { id: string; title: string; chain: Blockchain };
  request: {
    id: string;
    spotsRequested: number;
    communityName: string;
    contactName: string;
    contactMethod: ContactMethod;
    contactHandle: string;
  } | null;
};

/** Granted allocations on a team's listings (optionally one listing), newest first. */
export async function getTeamAllocations(teamId: string, listingId?: string): Promise<AllocationRow[]> {
  const rows = await db.collabAllocation.findMany({
    where: { listing: { teamId, ...(listingId ? { id: listingId } : {}) } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      spots: true,
      wallets: true,
      note: true,
      raffleUrl: true,
      proofImageUrl: true,
      reviewNote: true,
      reviewedAt: true,
      submittedAt: true,
      createdAt: true,
      confirmedAt: true,
      deliveredAt: true,
      team: { select: { name: true, slug: true, xHandle: true, discordInvite: true } },
      listing: { select: { id: true, title: true, chain: true } },
      request: {
        select: {
          id: true,
          spotsRequested: true,
          communityName: true,
          contactName: true,
          contactMethod: true,
          contactHandle: true,
        },
      },
    },
  });
  return rows.map((r) => ({ ...r, wallets: parseWallets(r.wallets) }));
}

// ---------------------------------------------------------------------------
// Platform admin: adding a request for a project with no oxbot account
// ---------------------------------------------------------------------------

export type AdminListingOption = {
  id: string;
  slug: string;
  title: string;
  spotsPerRequestMin: number;
  spotsPerRequestMax: number;
  available: number;
  team: { name: string; slug: string };
};

/** Every listing currently open for requests, across all teams. */
export async function getOpenListingsForAdmin(): Promise<AdminListingOption[]> {
  const now = new Date();
  const rows = await db.whitelistListing.findMany({
    where: { status: "OPEN", startAt: { lte: now }, endAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      spotsPerRequestMin: true,
      spotsPerRequestMax: true,
      totalSpots: true,
      reservedSpots: true,
      allocatedSpots: true,
      team: { select: { name: true, slug: true } },
    },
  });
  return rows.map((l) => ({
    id: l.id,
    slug: l.slug,
    title: l.title,
    spotsPerRequestMin: l.spotsPerRequestMin,
    spotsPerRequestMax: l.spotsPerRequestMax,
    available: availableSpots(l),
    team: l.team,
  }));
}

/** One listing for the admin add-request form (any status, so a paused/closed one is still viewable). */
export async function getListingForAdmin(listingId: string): Promise<AdminListingOption | null> {
  const l = await db.whitelistListing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      slug: true,
      title: true,
      spotsPerRequestMin: true,
      spotsPerRequestMax: true,
      totalSpots: true,
      reservedSpots: true,
      allocatedSpots: true,
      team: { select: { name: true, slug: true } },
    },
  });
  if (!l) return null;
  return {
    id: l.id,
    slug: l.slug,
    title: l.title,
    spotsPerRequestMin: l.spotsPerRequestMin,
    spotsPerRequestMax: l.spotsPerRequestMax,
    available: availableSpots(l),
    team: l.team,
  };
}

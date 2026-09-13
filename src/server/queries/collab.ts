import "server-only";

import { db } from "@/lib/db";
import {
  criteriaFromRow,
  isVerifiedTeam,
  parseEvidence,
  type CriteriaInput,
  type EligibilityCheck,
} from "@/lib/collab/eligibility";
import { OPEN_REQUEST_STATUSES, availableSpots } from "@/lib/collab/constants";
import type {
  AllocationStatus,
  AssetType,
  Blockchain,
  DistributionMethod,
  GiveawayStatus,
  GiveawayVisibility,
  ListingStatus,
  RequestStatus,
} from "@prisma/client";

/**
 * Team-scoped OxFoxes Collab queries for the dashboard. PRIVATE: these expose
 * requester pitches, stats, wallets and private notes — callers MUST verify
 * membership first (resolveTeamPage / requireTeamRole / requireTeamBySlug).
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
  distributionMethod: DistributionMethod;
  status: ListingStatus;
  visibility: GiveawayVisibility;
  startAt: Date;
  endAt: Date;
  totalSpots: number;
  reservedSpots: number;
  allocatedSpots: number;
  publicSpots: number;
  available: number;
  requestCount: number;
  openRequestCount: number;
  publicRaffle: { id: string; slug: string; status: GiveawayStatus } | null;
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
  distributionMethod: true,
  status: true,
  visibility: true,
  startAt: true,
  endAt: true,
  totalSpots: true,
  reservedSpots: true,
  allocatedSpots: true,
  publicSpots: true,
  createdAt: true,
  publicRaffle: { select: { id: true, slug: true, status: true } },
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
  drawSeed: string | null;
  drawnAt: Date | null;
  criteria: CriteriaInput | null;
  requestStatusCounts: Partial<Record<RequestStatus, number>>;
  allocationCounts: Partial<Record<AllocationStatus, { count: number; spots: number }>>;
  /** Open requests that meet the criteria (the partner-raffle pool). */
  qualifiedOpenCount: number;
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
      drawSeed: true,
      drawnAt: true,
      criteria: true,
    },
  });
  if (!row) return null;

  const [byStatus, allocations, qualifiedOpenCount] = await Promise.all([
    db.collabRequest.groupBy({ by: ["status"], where: { listingId }, _count: { _all: true } }),
    db.collabAllocation.groupBy({ by: ["status"], where: { listingId }, _count: { _all: true }, _sum: { spots: true } }),
    db.collabRequest.count({ where: { listingId, status: { in: OPEN_REQUEST_STATUSES }, eligible: true } }),
  ]);

  const { _count, criteria, ...rest } = row;
  const requestStatusCounts: ManagedListing["requestStatusCounts"] = {};
  for (const g of byStatus) requestStatusCounts[g.status] = g._count._all;
  const allocationCounts: ManagedListing["allocationCounts"] = {};
  for (const g of allocations) allocationCounts[g.status] = { count: g._count._all, spots: g._sum.spots ?? 0 };

  return {
    ...rest,
    available: availableSpots(rest),
    requestCount: _count.requests,
    openRequestCount: OPEN_REQUEST_STATUSES.reduce((n, s) => n + (requestStatusCounts[s] ?? 0), 0),
    criteria: criteriaFromRow(criteria),
    requestStatusCounts,
    allocationCounts,
    qualifiedOpenCount,
  };
}

export type CriteriaTemplate = { id: string; name: string; criteria: CriteriaInput; updatedAt: Date };

/** A team's saved criteria templates, most recently edited first. */
export async function getCriteriaTemplates(teamId: string): Promise<CriteriaTemplate[]> {
  const rows = await db.listingCriteria.findMany({
    where: { templateTeamId: teamId, listingId: null },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name ?? "Untitled template",
    criteria: criteriaFromRow(r)!,
    updatedAt: r.updatedAt,
  }));
}

export type CollabOverview = {
  listings: { open: number; total: number };
  spots: { total: number; available: number; granted: number; public: number };
  incoming: { open: number; total: number };
  outgoing: { open: number; approvedSpots: number };
  publicRaffles: { live: number; total: number };
};

/** Headline numbers for `/dashboard/[team]/collab`. */
export async function getCollabOverview(teamId: string): Promise<CollabOverview> {
  const now = new Date();
  const [listings, incomingOpen, incomingTotal, outgoingOpen, outgoingGranted, rafflesLive, rafflesTotal] =
    await Promise.all([
      db.whitelistListing.findMany({
        where: { teamId, status: { not: "CANCELLED" } },
        select: {
          status: true,
          totalSpots: true,
          reservedSpots: true,
          allocatedSpots: true,
          publicSpots: true,
        },
      }),
      db.collabRequest.count({ where: { listing: { teamId }, status: { in: OPEN_REQUEST_STATUSES } } }),
      db.collabRequest.count({ where: { listing: { teamId } } }),
      db.collabRequest.count({ where: { requesterTeamId: teamId, status: { in: OPEN_REQUEST_STATUSES } } }),
      db.collabAllocation.aggregate({
        where: { teamId, status: { not: "REVOKED" } },
        _sum: { spots: true },
      }),
      db.giveaway.count({
        where: { teamId, listingId: { not: null }, status: "ACTIVE", startAt: { lte: now }, endAt: { gt: now } },
      }),
      db.giveaway.count({ where: { teamId, listingId: { not: null } } }),
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
      public: listings.reduce((n, l) => n + l.publicSpots, 0),
    },
    incoming: { open: incomingOpen, total: incomingTotal },
    outgoing: { open: outgoingOpen, approvedSpots: outgoingGranted._sum.spots ?? 0 },
    publicRaffles: { live: rafflesLive, total: rafflesTotal },
  };
}

// ---------------------------------------------------------------------------
// Platform-computed requester facts (eligibility inputs oxbot can vouch for)
// ---------------------------------------------------------------------------

export type TeamPlatformFacts = {
  raffleEntries: number;
  verifiedTeam: boolean;
};

/**
 * For each team: completed entries across its oxbot giveaways, and whether it
 * counts as a verified project (logo + a social + a published drop).
 */
export async function getTeamPlatformFacts(teamIds: string[]): Promise<Map<string, TeamPlatformFacts>> {
  const out = new Map<string, TeamPlatformFacts>();
  if (teamIds.length === 0) return out;

  const [teams, entries, giveaways, listings] = await Promise.all([
    db.team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, logoUrl: true, xHandle: true, discordInvite: true },
    }),
    db.giveaway.findMany({
      where: { teamId: { in: teamIds } },
      select: { teamId: true, _count: { select: { entries: { where: { status: "COMPLETED" } } } } },
    }),
    db.giveaway.groupBy({
      by: ["teamId"],
      where: { teamId: { in: teamIds }, status: { notIn: ["DRAFT", "CANCELLED"] } },
      _count: { _all: true },
    }),
    db.whitelistListing.groupBy({
      by: ["teamId"],
      where: { teamId: { in: teamIds }, status: { notIn: ["DRAFT", "CANCELLED"] } },
      _count: { _all: true },
    }),
  ]);

  const entriesByTeam = new Map<string, number>();
  for (const g of entries) entriesByTeam.set(g.teamId, (entriesByTeam.get(g.teamId) ?? 0) + g._count.entries);
  const giveawaysByTeam = new Map(giveaways.map((g) => [g.teamId, g._count._all]));
  const listingsByTeam = new Map(listings.map((l) => [l.teamId, l._count._all]));

  for (const t of teams) {
    out.set(t.id, {
      raffleEntries: entriesByTeam.get(t.id) ?? 0,
      verifiedTeam: isVerifiedTeam({
        logoUrl: t.logoUrl,
        xHandle: t.xHandle,
        discordInvite: t.discordInvite,
        publishedGiveaways: giveawaysByTeam.get(t.id) ?? 0,
        publishedListings: listingsByTeam.get(t.id) ?? 0,
      }),
    });
  }
  return out;
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
  eligible: boolean;
  eligibilityScore: number;
  communitySize: number | null;
  twitterFollowers: number | null;
  discordMembers: number | null;
  pitch: string;
  communityName: string | null;
  createdAt: Date;
  requesterTeam: { name: string; slug: string; logoUrl: string | null; xHandle: string | null };
  listing: { id: string; title: string; distributionMethod: DistributionMethod };
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
      eligible: true,
      eligibilityScore: true,
      communitySize: true,
      twitterFollowers: true,
      discordMembers: true,
      pitch: true,
      communityName: true,
      createdAt: true,
      requesterTeam: { select: { name: true, slug: true, logoUrl: true, xHandle: true } },
      listing: { select: { id: true, title: true, distributionMethod: true } },
    },
  });
}

/** Defensive parse of a stored eligibility snapshot. */
function parseChecks(raw: unknown): EligibilityCheck[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (c): c is EligibilityCheck =>
      Boolean(c) &&
      typeof c === "object" &&
      typeof (c as EligibilityCheck).label === "string" &&
      typeof (c as EligibilityCheck).met === "boolean"
  );
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
      reviewedBy: { select: { name: true, email: true } },
      allocation: true,
      listing: {
        select: {
          id: true,
          slug: true,
          title: true,
          chain: true,
          distributionMethod: true,
          status: true,
          totalSpots: true,
          reservedSpots: true,
          allocatedSpots: true,
          publicSpots: true,
          spotsPerRequestMin: true,
          spotsPerRequestMax: true,
          criteria: true,
        },
      },
    },
  });
  if (!r) return null;
  return {
    ...r,
    evidence: parseEvidence(r.evidence),
    checks: parseChecks(r.eligibility),
    listing: { ...r.listing, available: availableSpots(r.listing), criteria: criteriaFromRow(r.listing.criteria) },
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
  eligible: boolean;
  eligibilityScore: number;
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
    distributionMethod: DistributionMethod;
    mintOrTgeAt: Date | null;
    status: ListingStatus;
    team: { name: string; slug: string; logoUrl: string | null; xHandle: string | null; discordInvite: string | null };
  };
  allocation: {
    id: string;
    status: AllocationStatus;
    spots: number;
    wallets: AllocationWallet[];
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
      eligible: true,
      eligibilityScore: true,
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
          distributionMethod: true,
          mintOrTgeAt: true,
          status: true,
          team: { select: { name: true, slug: true, logoUrl: true, xHandle: true, discordInvite: true } },
        },
      },
      allocation: {
        select: { id: true, status: true, spots: true, wallets: true, confirmedAt: true, deliveredAt: true },
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
  createdAt: Date;
  confirmedAt: Date | null;
  deliveredAt: Date | null;
  team: { name: string; slug: string; xHandle: string | null; discordInvite: string | null };
  listing: { id: string; title: string; chain: Blockchain };
  request: {
    id: string;
    walletForDelivery: string | null;
    spotsRequested: number;
    communityName: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactX: string | null;
    contactDiscord: string | null;
    contactTelegram: string | null;
  } | null;
};

export type TeamPublicRaffleRow = {
  listing: {
    id: string;
    slug: string;
    title: string;
    assetType: AssetType;
    chain: Blockchain;
    collectionAddress: string | null;
    collectionName: string | null;
    tokenAddress: string | null;
    tokenSymbol: string | null;
    publicSpots: number;
    status: ListingStatus;
    startAt: Date;
    endAt: Date;
  };
  raffle: {
    id: string;
    slug: string;
    title: string;
    type: import("@prisma/client").GiveawayType;
    status: GiveawayStatus;
    startAt: Date;
    endAt: Date;
    winnersCount: number;
    fcfsCursor: number;
    entryCount: number;
    winnerCount: number;
  } | null;
};

/** Listings with a public slice, and the raffle (if opened) for each. */
export async function getTeamPublicRaffles(teamId: string): Promise<TeamPublicRaffleRow[]> {
  const rows = await db.whitelistListing.findMany({
    where: { teamId, status: { not: "CANCELLED" }, OR: [{ publicSpots: { gt: 0 } }, { publicRaffle: { isNot: null } }] },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      assetType: true,
      chain: true,
      collectionAddress: true,
      collectionName: true,
      tokenAddress: true,
      tokenSymbol: true,
      publicSpots: true,
      status: true,
      startAt: true,
      endAt: true,
      publicRaffle: {
        select: {
          id: true,
          slug: true,
          title: true,
          type: true,
          status: true,
          startAt: true,
          endAt: true,
          winnersCount: true,
          fcfsCursor: true,
          _count: { select: { entries: true, winners: true } },
        },
      },
    },
  });
  return rows.map(({ publicRaffle, ...listing }) => ({
    listing,
    raffle: publicRaffle
      ? {
          id: publicRaffle.id,
          slug: publicRaffle.slug,
          title: publicRaffle.title,
          type: publicRaffle.type,
          status: publicRaffle.status,
          startAt: publicRaffle.startAt,
          endAt: publicRaffle.endAt,
          winnersCount: publicRaffle.winnersCount,
          fcfsCursor: publicRaffle.fcfsCursor,
          entryCount: publicRaffle._count.entries,
          winnerCount: publicRaffle._count.winners,
        }
      : null,
  }));
}

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
      createdAt: true,
      confirmedAt: true,
      deliveredAt: true,
      team: { select: { name: true, slug: true, xHandle: true, discordInvite: true } },
      listing: { select: { id: true, title: true, chain: true } },
      request: {
        select: {
          id: true,
          walletForDelivery: true,
          spotsRequested: true,
          communityName: true,
          contactName: true,
          contactEmail: true,
          contactX: true,
          contactDiscord: true,
          contactTelegram: true,
        },
      },
    },
  });
  return rows.map((r) => ({ ...r, wallets: parseWallets(r.wallets) }));
}

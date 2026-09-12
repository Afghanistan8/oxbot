import "server-only";

import { db } from "@/lib/db";
import { criteriaFromRow, type CriteriaInput } from "@/lib/collab/eligibility";
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

  const [byStatus, allocations] = await Promise.all([
    db.collabRequest.groupBy({ by: ["status"], where: { listingId }, _count: { _all: true } }),
    db.collabAllocation.groupBy({ by: ["status"], where: { listingId }, _count: { _all: true }, _sum: { spots: true } }),
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

import "server-only";

import { db } from "@/lib/db";
import { criteriaFromRow, type CriteriaInput } from "@/lib/collab/eligibility";
import { ACTIVE_REQUEST_STATUSES, PUBLIC_LISTING_STATUSES, availableSpots } from "@/lib/collab/constants";
import { getTeamPlatformFacts } from "@/server/queries/collab";
import type {
  AssetType,
  Blockchain,
  DistributionMethod,
  GiveawayStatus,
  ListingStatus,
  Prisma,
  RequestStatus,
  TeamRole,
} from "@prisma/client";

/**
 * Public, read-only Collab queries for the desk. PRIVACY: nothing here returns
 * who applied, their pitches, stats or wallets — only listing-level fields and
 * aggregate counts (and the count is omitted when `hideRequestCount` is set).
 * The one viewer-specific read is the viewer's OWN teams' requests.
 */

export type ListingCardData = {
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
  startAt: Date;
  endAt: Date;
  totalSpots: number;
  reservedSpots: number;
  allocatedSpots: number;
  publicSpots: number;
  available: number;
  /** Null when the listing hides its request count. */
  requestCount: number | null;
  team: { name: string; slug: string; logoUrl: string | null };
  /** The linked public raffle when it's publicly visible. */
  publicRaffle: { slug: string; status: GiveawayStatus; startAt: Date; endAt: Date } | null;
};

const cardInclude = {
  team: { select: { name: true, slug: true, logoUrl: true } },
  publicRaffle: { select: { slug: true, status: true, startAt: true, endAt: true, visibility: true } },
  _count: { select: { requests: true } },
} satisfies Prisma.WhitelistListingInclude;

type CardRow = Prisma.WhitelistListingGetPayload<{ include: typeof cardInclude }>;

function toCard(l: CardRow): ListingCardData {
  const raffle = l.publicRaffle;
  const raffleVisible =
    raffle && raffle.visibility !== "PRIVATE" && raffle.status !== "DRAFT" && raffle.status !== "CANCELLED";
  return {
    id: l.id,
    slug: l.slug,
    title: l.title,
    bannerUrl: l.bannerUrl,
    assetType: l.assetType,
    chain: l.chain,
    collectionName: l.collectionName,
    tokenSymbol: l.tokenSymbol,
    distributionMethod: l.distributionMethod,
    status: l.status,
    startAt: l.startAt,
    endAt: l.endAt,
    totalSpots: l.totalSpots,
    reservedSpots: l.reservedSpots,
    allocatedSpots: l.allocatedSpots,
    publicSpots: l.publicSpots,
    available: availableSpots(l),
    requestCount: l.hideRequestCount ? null : l._count.requests,
    team: l.team,
    publicRaffle: raffleVisible
      ? { slug: raffle.slug, status: raffle.status, startAt: raffle.startAt, endAt: raffle.endAt }
      : null,
  };
}

export type ListingFilter = {
  chain?: Blockchain;
  assetType?: AssetType;
  method?: DistributionMethod;
  /** Only listings accepting requests right now with spots left. */
  openOnly?: boolean;
  sort?: "ending" | "new" | "spots";
  take?: number;
  teamId?: string;
};

/** Browsable listings: PUBLIC + COMMUNITY, never drafts or cancelled. */
export async function listPublicListings(filter: ListingFilter = {}): Promise<ListingCardData[]> {
  const { chain, assetType, method, openOnly = false, sort = "ending", take = 48, teamId } = filter;
  const now = new Date();
  const rows = await db.whitelistListing.findMany({
    where: {
      visibility: { in: ["PUBLIC", "COMMUNITY"] },
      status: openOnly ? "OPEN" : { in: PUBLIC_LISTING_STATUSES },
      ...(openOnly ? { startAt: { lte: now }, endAt: { gt: now } } : {}),
      ...(chain ? { chain } : {}),
      ...(assetType ? { assetType } : {}),
      ...(method ? { distributionMethod: method } : {}),
      ...(teamId ? { teamId } : {}),
    },
    include: cardInclude,
    orderBy: sort === "new" ? [{ createdAt: "desc" }] : [{ status: "asc" }, { endAt: "asc" }],
    take: sort === "spots" ? 200 : take,
  });

  const cards = rows.map(toCard).filter((c) => !openOnly || c.available > 0);
  if (sort === "spots") {
    return cards.sort((a, b) => b.available - a.available).slice(0, take);
  }
  // Keep open listings ahead of closed ones for "ending soon".
  if (sort === "ending") {
    const rank = (c: ListingCardData) => (c.status === "OPEN" && c.endAt > now ? 0 : c.status === "ALLOCATED" || c.status === "PAUSED" ? 1 : 2);
    return cards.sort((a, b) => rank(a) - rank(b) || a.endAt.getTime() - b.endAt.getTime());
  }
  return cards;
}

export type CollabSignal = { openListings: number; spotsRemaining: number; liveRaffles: number };

/** Live signal strip on the Collab landing. */
export async function getCollabSignal(): Promise<CollabSignal> {
  const now = new Date();
  const [open, liveRaffles] = await Promise.all([
    db.whitelistListing.findMany({
      where: { visibility: { in: ["PUBLIC", "COMMUNITY"] }, status: "OPEN", startAt: { lte: now }, endAt: { gt: now } },
      select: { totalSpots: true, reservedSpots: true, allocatedSpots: true, publicSpots: true },
    }),
    db.giveaway.count({
      where: {
        listingId: { not: null },
        visibility: { in: ["PUBLIC", "COMMUNITY"] },
        status: "ACTIVE",
        startAt: { lte: now },
        endAt: { gt: now },
      },
    }),
  ]);
  return {
    openListings: open.length,
    spotsRemaining: open.reduce((n, l) => n + availableSpots(l), 0),
    liveRaffles,
  };
}

export type FeaturedPartner = { name: string; slug: string; logoUrl: string | null; openListings: number };

/** Projects with listings on the desk right now (listing teams — never requesters). */
export async function getFeaturedPartners(take = 8): Promise<FeaturedPartner[]> {
  const grouped = await db.whitelistListing.groupBy({
    by: ["teamId"],
    where: { visibility: { in: ["PUBLIC", "COMMUNITY"] }, status: { in: ["OPEN", "ALLOCATED"] } },
    _count: { _all: true },
    orderBy: { _count: { teamId: "desc" } },
    take,
  });
  if (grouped.length === 0) return [];
  const teams = await db.team.findMany({
    where: { id: { in: grouped.map((g) => g.teamId) } },
    select: { id: true, name: true, slug: true, logoUrl: true },
  });
  const byId = new Map(teams.map((t) => [t.id, t]));
  return grouped.flatMap((g) => {
    const t = byId.get(g.teamId);
    return t ? [{ name: t.name, slug: t.slug, logoUrl: t.logoUrl, openListings: g._count._all }] : [];
  });
}

export type ViewerRequestSummary = {
  id: string;
  teamName: string;
  teamSlug: string;
  status: RequestStatus;
  spotsRequested: number;
  spotsGranted: number | null;
};

export type RequesterTeamOption = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  role: TeamRole;
  chains: Blockchain[];
  raffleEntries: number;
  verifiedTeam: boolean;
  /** An active request on this listing already exists for this team. */
  hasActiveRequest: boolean;
};

export type PublicListingDetail = ListingCardData & {
  description: string | null;
  collectionAddress: string | null;
  tokenAddress: string | null;
  mintOrTgeAt: Date | null;
  spotsPerRequestMin: number;
  spotsPerRequestMax: number;
  visibility: "PUBLIC" | "COMMUNITY" | "PRIVATE";
  drawnAt: Date | null;
  criteria: CriteriaInput | null;
  team: ListingCardData["team"] & {
    id: string;
    description: string | null;
    xHandle: string | null;
    discordInvite: string | null;
    website: string | null;
    totalSupply: string | null;
    mintPrice: string | null;
  };
  /** Viewer-scoped: requests filed by teams the viewer belongs to. */
  viewerRequests: ViewerRequestSummary[];
  /** Viewer-scoped: teams the viewer can request on behalf of (EDITOR+, not the listing team). */
  requesterTeams: RequesterTeamOption[];
  /** True when the viewer is a member of the listing team. */
  viewerIsOwner: boolean;
};

/**
 * One listing for its public page. PRIVATE listings resolve by direct link;
 * drafts and cancelled listings never do.
 */
export async function getPublicListing(slug: string, viewerId: string | null): Promise<PublicListingDetail | null> {
  const l = await db.whitelistListing.findUnique({
    where: { slug },
    include: {
      ...cardInclude,
      team: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          description: true,
          xHandle: true,
          discordInvite: true,
          website: true,
          totalSupply: true,
          mintPrice: true,
        },
      },
      criteria: true,
    },
  });
  if (!l || l.status === "DRAFT" || l.status === "CANCELLED") return null;

  let viewerRequests: ViewerRequestSummary[] = [];
  let requesterTeams: RequesterTeamOption[] = [];
  let viewerIsOwner = false;

  if (viewerId) {
    const memberships = await db.teamMember.findMany({
      where: { userId: viewerId },
      select: { role: true, team: { select: { id: true, name: true, slug: true, logoUrl: true, chains: true } } },
      orderBy: { createdAt: "asc" },
    });
    viewerIsOwner = memberships.some((m) => m.team.id === l.teamId);
    const teamIds = memberships.map((m) => m.team.id).filter((id) => id !== l.teamId);

    if (teamIds.length) {
      const [requests, facts] = await Promise.all([
        db.collabRequest.findMany({
          where: { listingId: l.id, requesterTeamId: { in: teamIds } },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            spotsRequested: true,
            spotsGranted: true,
            requesterTeam: { select: { name: true, slug: true, id: true } },
          },
        }),
        getTeamPlatformFacts(teamIds),
      ]);
      viewerRequests = requests.map((r) => ({
        id: r.id,
        teamName: r.requesterTeam.name,
        teamSlug: r.requesterTeam.slug,
        status: r.status,
        spotsRequested: r.spotsRequested,
        spotsGranted: r.spotsGranted,
      }));
      const active = new Set(
        requests.filter((r) => ACTIVE_REQUEST_STATUSES.includes(r.status)).map((r) => r.requesterTeam.id)
      );
      // Every TeamRole (OWNER/ADMIN/EDITOR) may file on the team's behalf.
      requesterTeams = memberships
        .filter((m) => m.team.id !== l.teamId)
        .map((m) => ({
          id: m.team.id,
          name: m.team.name,
          slug: m.team.slug,
          logoUrl: m.team.logoUrl,
          role: m.role,
          chains: m.team.chains,
          raffleEntries: facts.get(m.team.id)?.raffleEntries ?? 0,
          verifiedTeam: facts.get(m.team.id)?.verifiedTeam ?? false,
          hasActiveRequest: active.has(m.team.id),
        }));
    }
  }

  const card = toCard(l);
  return {
    ...card,
    description: l.description,
    collectionAddress: l.collectionAddress,
    tokenAddress: l.tokenAddress,
    mintOrTgeAt: l.mintOrTgeAt,
    spotsPerRequestMin: l.spotsPerRequestMin,
    spotsPerRequestMax: l.spotsPerRequestMax,
    visibility: l.visibility,
    drawnAt: l.drawnAt,
    criteria: criteriaFromRow(l.criteria),
    team: { ...card.team, ...l.team },
    viewerRequests,
    requesterTeams,
    viewerIsOwner,
  };
}

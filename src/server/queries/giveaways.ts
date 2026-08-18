import "server-only";

import { db } from "@/lib/db";
import type { GiveawayCardData } from "@/types/giveaway";
import type { Blockchain, Giveaway, Team } from "@prisma/client";

/**
 * Public, read-only giveaway queries.
 *
 * These are the ONLY functions the public site uses to read giveaways. They
 * deliberately return the privacy-safe {@link GiveawayCardData} shape — never
 * entries, entrant users, codes, or draw seeds. Entry counts are omitted
 * entirely when a giveaway sets `hideEntryCount`, so the number can't leak
 * through the network payload.
 */

type GiveawayWithTeamAndCount = Giveaway & {
  team: Pick<Team, "name" | "slug" | "logoUrl" | "xHandle">;
  _count: { entries: number };
};

/** Project a DB row onto the public card view-model, honoring privacy flags. */
function toCardData(g: GiveawayWithTeamAndCount): GiveawayCardData {
  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    prize: g.prize,
    bannerUrl: g.bannerUrl,
    type: g.type,
    chain: g.chain,
    visibility: g.visibility,
    status: g.status,
    startAt: g.startAt,
    endAt: g.endAt,
    winnersCount: g.winnersCount,
    fcfsCursor: g.fcfsCursor,
    hideEntryCount: g.hideEntryCount,
    // Only expose a count when the creator hasn't hidden it.
    entryCount: g.hideEntryCount ? null : g._count.entries,
    team: {
      name: g.team.name,
      slug: g.team.slug,
      logoUrl: g.team.logoUrl,
      xHandle: g.team.xHandle,
    },
  };
}

export type PublicGiveawayFilter = {
  chain?: Blockchain;
  /** "ending" surfaces active giveaways closing soonest; "new" is newest-first. */
  sort?: "ending" | "new";
  /** When true, only include giveaways currently accepting entries. */
  liveOnly?: boolean;
  take?: number;
};

/**
 * List discoverable giveaways for the landing grid.
 *
 * PUBLIC and COMMUNITY rows in listable states are returned — both are meant to
 * be browsable (COMMUNITY just gates *entry* on Discord/Telegram membership).
 * PRIVATE (code-gated, shared directly) and drafts never appear. Ordering keeps
 * live giveaways ahead of scheduled/ended ones.
 */
export async function listPublicGiveaways(
  filter: PublicGiveawayFilter = {}
): Promise<GiveawayCardData[]> {
  const { chain, sort = "ending", liveOnly = false, take = 24 } = filter;
  const now = new Date();

  const rows = await db.giveaway.findMany({
    where: {
      visibility: { in: ["PUBLIC", "COMMUNITY"] },
      status: liveOnly
        ? "ACTIVE"
        : { in: ["ACTIVE", "SCHEDULED", "ENDED", "FINALIZED"] },
      ...(chain ? { chain } : {}),
      ...(liveOnly ? { startAt: { lte: now }, endAt: { gt: now } } : {}),
    },
    include: {
      team: { select: { name: true, slug: true, logoUrl: true, xHandle: true } },
      _count: { select: { entries: true } },
    },
    orderBy:
      sort === "new"
        ? [{ createdAt: "desc" }]
        : [{ status: "asc" }, { endAt: "asc" }],
    take,
  });

  return rows.map(toCardData);
}

/** Count of currently-live discoverable giveaways (for the hero stat). */
export async function countLivePublicGiveaways(): Promise<number> {
  const now = new Date();
  return db.giveaway.count({
    where: {
      visibility: { in: ["PUBLIC", "COMMUNITY"] },
      status: "ACTIVE",
      startAt: { lte: now },
      endAt: { gt: now },
    },
  });
}

/** Distinct chains that currently have discoverable giveaways (for filter chips). */
export async function activePublicChains(): Promise<Blockchain[]> {
  const rows = await db.giveaway.findMany({
    where: {
      visibility: { in: ["PUBLIC", "COMMUNITY"] },
      status: { in: ["ACTIVE", "SCHEDULED", "ENDED", "FINALIZED"] },
    },
    distinct: ["chain"],
    select: { chain: true },
  });
  return rows.map((r) => r.chain);
}

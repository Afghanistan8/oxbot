import "server-only";

import { db } from "@/lib/db";
import type {
  EntryStatus,
  GiveawayStatus,
  RequirementStatus,
  WinnerMethod,
} from "@prisma/client";

/**
 * Team-scoped giveaway queries for the founder dashboard. Callers MUST verify
 * team membership first (via resolveTeamPage / requireTeamRole).
 */

export type DashboardGiveaway = {
  id: string;
  slug: string;
  title: string;
  prize: string;
  bannerUrl: string | null;
  type: import("@prisma/client").GiveawayType;
  chain: import("@prisma/client").Blockchain;
  visibility: import("@prisma/client").GiveawayVisibility;
  status: GiveawayStatus;
  startAt: Date;
  endAt: Date;
  winnersCount: number;
  fcfsCursor: number;
  hideEntryCount: boolean;
  entryCount: number;
  completedCount: number;
  winnerCount: number;
  createdAt: Date;
};

/** List a team's giveaways (newest first) with entry/winner counts. */
export async function getTeamGiveaways(teamId: string): Promise<DashboardGiveaway[]> {
  const rows = await db.giveaway.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { entries: true, winners: true } },
    },
  });

  // Completed-entry counts in one grouped query (avoids N+1).
  const completed = await db.entry.groupBy({
    by: ["giveawayId"],
    where: { giveaway: { teamId }, status: "COMPLETED" },
    _count: { _all: true },
  });
  const completedMap = new Map(completed.map((c) => [c.giveawayId, c._count._all]));

  return rows.map((g) => ({
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
    entryCount: g._count.entries,
    completedCount: completedMap.get(g.id) ?? 0,
    winnerCount: g._count.winners,
    createdAt: g.createdAt,
  }));
}

export type ManagedRequirement = {
  id: string;
  type: import("@prisma/client").RequirementType;
  required: boolean;
  order: number;
  config: Record<string, unknown>;
};

export type ManagedGiveaway = {
  id: string;
  teamId: string;
  slug: string;
  title: string;
  description: string | null;
  prize: string;
  bannerUrl: string | null;
  type: import("@prisma/client").GiveawayType;
  chain: import("@prisma/client").Blockchain;
  visibility: import("@prisma/client").GiveawayVisibility;
  status: GiveawayStatus;
  winnersCount: number;
  fcfsCursor: number;
  startAt: Date;
  endAt: Date;
  hideEntryCount: boolean;
  xAccount: string | null;
  discordServerId: string | null;
  telegram: string | null;
  drawnAt: Date | null;
  drawSeed: string | null;
  createdAt: Date;
  requirements: ManagedRequirement[];
  entryCount: number;
  completedCount: number;
  winnerCount: number;
  codeCount: number;
};

/**
 * Load a single giveaway scoped to its team, with requirements + counts, for
 * the founder management + edit views. Returns null if it doesn't belong to the
 * team (callers combine this with resolveTeamPage → notFound()).
 */
export async function getManagedGiveaway(
  teamId: string,
  giveawayId: string
): Promise<ManagedGiveaway | null> {
  const g = await db.giveaway.findFirst({
    where: { id: giveawayId, teamId },
    include: {
      requirements: { orderBy: { order: "asc" } },
      _count: { select: { entries: true, winners: true, codes: true } },
    },
  });
  if (!g) return null;

  const completedCount = await db.entry.count({
    where: { giveawayId: g.id, status: "COMPLETED" },
  });

  return {
    id: g.id,
    teamId: g.teamId,
    slug: g.slug,
    title: g.title,
    description: g.description,
    prize: g.prize,
    bannerUrl: g.bannerUrl,
    type: g.type,
    chain: g.chain,
    visibility: g.visibility,
    status: g.status,
    winnersCount: g.winnersCount,
    fcfsCursor: g.fcfsCursor,
    startAt: g.startAt,
    endAt: g.endAt,
    hideEntryCount: g.hideEntryCount,
    xAccount: g.xAccount,
    discordServerId: g.discordServerId,
    telegram: g.telegram,
    drawnAt: g.drawnAt,
    drawSeed: g.drawSeed,
    createdAt: g.createdAt,
    requirements: g.requirements.map((r) => ({
      id: r.id,
      type: r.type,
      required: r.required,
      order: r.order,
      config: (r.config ?? {}) as Record<string, unknown>,
    })),
    entryCount: g._count.entries,
    completedCount,
    winnerCount: g._count.winners,
    codeCount: g._count.codes,
  };
}

export type TeamStats = {
  totalGiveaways: number;
  activeGiveaways: number;
  totalEntries: number;
  totalWinners: number;
};

/** Aggregate headline stats for a team's overview. */
export async function getTeamStats(teamId: string): Promise<TeamStats> {
  const now = new Date();
  const [totalGiveaways, activeGiveaways, totalEntries, totalWinners] =
    await Promise.all([
      db.giveaway.count({ where: { teamId } }),
      db.giveaway.count({
        where: { teamId, status: "ACTIVE", startAt: { lte: now }, endAt: { gt: now } },
      }),
      db.entry.count({ where: { giveaway: { teamId } } }),
      db.winner.count({ where: { giveaway: { teamId } } }),
    ]);
  return { totalGiveaways, activeGiveaways, totalEntries, totalWinners };
}

export type AuditLogEntry = {
  id: string;
  action: string;
  target: string | null;
  meta: Record<string, unknown> | null;
  createdAt: Date;
  actorName: string | null;
  actorEmail: string | null;
  actorImage: string | null;
};

/** Recent audit-log entries for a team (with actor display info), newest first. */
export async function getTeamAuditLog(teamId: string, take = 20): Promise<AuditLogEntry[]> {
  const rows = await db.auditLog.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      actor: { select: { name: true, email: true, image: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    target: r.target,
    meta:
      r.meta && typeof r.meta === "object" && !Array.isArray(r.meta)
        ? (r.meta as Record<string, unknown>)
        : null,
    createdAt: r.createdAt,
    actorName: r.actor?.name ?? null,
    actorEmail: r.actor?.email ?? null,
    actorImage: r.actor?.image ?? null,
  }));
}

// ---------------------------------------------------------------------------
// PRIVATE entrant + winner data (team-only).
//
// These expose full entrant identity (name/email/wallet) and are the reason the
// entry list is private — callers MUST gate on team membership first (via
// resolveTeamPage / requireTeamRole / requireTeamBySlug). Nothing here is ever
// used by public pages.
// ---------------------------------------------------------------------------

export type EntrantRequirementStatus = {
  requirementId: string;
  status: RequirementStatus;
};

export type EntrantRow = {
  entryId: string;
  userId: string;
  status: EntryStatus;
  seq: number | null;
  submittedAt: Date | null;
  createdAt: Date;
  name: string | null;
  email: string | null;
  image: string | null;
  /** Wallet captured on entry (from metadata), if any. */
  wallet: string | null;
  /** The entry code redeemed, if this giveaway is code-gated. */
  code: string | null;
  isWinner: boolean;
  winnerRank: number | null;
  /** Per-requirement pass/fail, keyed by requirementId. */
  requirementStatuses: EntrantRequirementStatus[];
};

/** Pull a wallet address out of an entry's metadata blob, defensively. */
function walletFromMetadata(metadata: unknown): string | null {
  if (metadata && typeof metadata === "object" && "wallet" in metadata) {
    const w = (metadata as { wallet?: unknown }).wallet;
    return typeof w === "string" && w.trim() ? w : null;
  }
  return null;
}

/**
 * Load a giveaway's entrants (PRIVATE). Optionally filter by status. Ordered by
 * FCFS slot first (seq asc, nulls last) then entry time — so completed entries
 * appear in draw order and pending/disqualified follow.
 */
export async function getGiveawayEntrants(
  giveawayId: string,
  opts: { status?: EntryStatus } = {}
): Promise<EntrantRow[]> {
  const entries = await db.entry.findMany({
    where: { giveawayId, ...(opts.status ? { status: opts.status } : {}) },
    orderBy: [{ seq: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    include: {
      user: { select: { name: true, email: true, image: true } },
      statuses: { select: { requirementId: true, status: true } },
      winner: { select: { rank: true } },
      codeUse: { select: { code: { select: { code: true } } } },
    },
  });

  return entries.map((e) => ({
    entryId: e.id,
    userId: e.userId,
    status: e.status,
    seq: e.seq,
    submittedAt: e.submittedAt,
    createdAt: e.createdAt,
    name: e.user.name,
    email: e.user.email,
    image: e.user.image,
    wallet: walletFromMetadata(e.metadata),
    code: e.codeUse?.code.code ?? null,
    isWinner: Boolean(e.winner),
    winnerRank: e.winner?.rank ?? null,
    requirementStatuses: e.statuses.map((s) => ({
      requirementId: s.requirementId,
      status: s.status,
    })),
  }));
}

export type WinnerRow = {
  rank: number;
  entryId: string;
  userId: string;
  method: WinnerMethod;
  name: string | null;
  email: string | null;
  image: string | null;
  seq: number | null;
};

/** Load a giveaway's winners with full (private) identity, ranked. */
export async function getGiveawayWinners(giveawayId: string): Promise<WinnerRow[]> {
  const winners = await db.winner.findMany({
    where: { giveawayId },
    orderBy: { rank: "asc" },
    include: {
      user: { select: { name: true, email: true, image: true } },
      entry: { select: { seq: true } },
    },
  });

  return winners.map((w) => ({
    rank: w.rank,
    entryId: w.entryId,
    userId: w.userId,
    method: w.method,
    name: w.user.name,
    email: w.user.email,
    image: w.user.image,
    seq: w.entry.seq,
  }));
}

export type WinnerExportRow = {
  rank: number;
  name: string | null;
  email: string | null;
  discordUsername: string | null;
  wallet: string | null;
  /** When the entry was completed — "time of entry" for the export. */
  enteredAt: Date | null;
  seq: number | null;
};

/**
 * Winners with the fields founders actually need for prize fulfillment:
 * entry time, Discord handle, and the wallet address used to enter. Backs the
 * "Download winners" CSV export.
 */
export async function getWinnerExportRows(giveawayId: string): Promise<WinnerExportRow[]> {
  const [giveaway, winners] = await Promise.all([
    db.giveaway.findUnique({ where: { id: giveawayId }, select: { chain: true } }),
    db.winner.findMany({
      where: { giveawayId },
      orderBy: { rank: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
        entry: { select: { submittedAt: true, seq: true, metadata: true } },
      },
    }),
  ]);

  const userIds = winners.map((w) => w.userId);
  const [discordConnections, profileWallets] = await Promise.all([
    db.socialConnection.findMany({
      where: { userId: { in: userIds }, provider: "discord" },
      select: { userId: true, username: true },
    }),
    // Fall back to the winner's saved profile wallet when they didn't paste one
    // at entry time — so wallets still make it onto the export for giveaways
    // without a wallet task, as long as the winner filled in their profile.
    db.wallet.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, chain: true, address: true },
    }),
  ]);
  const discordByUser = new Map(discordConnections.map((c) => [c.userId, c.username]));

  // Prefer a profile wallet on the giveaway's own chain; otherwise any wallet.
  const walletByUser = new Map<string, string>();
  for (const w of profileWallets) {
    if (!w.address?.trim()) continue;
    const isChainMatch = giveaway?.chain != null && w.chain === giveaway.chain;
    if (isChainMatch || !walletByUser.has(w.userId)) {
      walletByUser.set(w.userId, w.address.trim());
    }
  }

  return winners.map((w) => ({
    rank: w.rank,
    name: w.user.name,
    email: w.user.email,
    discordUsername: discordByUser.get(w.userId) ?? null,
    wallet: walletFromMetadata(w.entry.metadata) ?? walletByUser.get(w.userId) ?? null,
    enteredAt: w.entry.submittedAt,
    seq: w.entry.seq,
  }));
}

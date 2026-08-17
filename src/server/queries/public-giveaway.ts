import "server-only";

import { db } from "@/lib/db";
import { readConfig, type RequirementConfig } from "@/lib/giveaway/entry-validation";
import type {
  Blockchain,
  EntryStatus,
  GiveawayStatus,
  GiveawayType,
  GiveawayVisibility,
  RequirementStatus,
  RequirementType,
  TeamRole,
} from "@prisma/client";

/**
 * Public, read-only giveaway *detail* query for the participant-facing page.
 *
 * Like the listing queries, this NEVER exposes entrant data. It returns:
 *  - the giveaway's public fields + project context,
 *  - its requirements (config sanitized to display-safe values),
 *  - a privacy-aware entry count (null when hidden),
 *  - and, only for the requesting viewer, THEIR OWN entry + per-requirement
 *    status (so the wizard can show progress). No other entrant is ever read.
 */

export type PublicRequirement = {
  id: string;
  type: RequirementType;
  required: boolean;
  order: number;
  /** Display-safe config (handle, tweet URL, guild id, role count, chain). */
  config: RequirementConfig;
  /** The viewer's status for this requirement, if they've started an entry. */
  viewerStatus: RequirementStatus | null;
};

export type ViewerEntry = {
  status: EntryStatus;
  seq: number | null;
  isWinner: boolean;
  winnerRank: number | null;
};

/** A publicly-shown project team member (founder / admins) for the giveaway page. */
export type PublicTeamMember = {
  role: TeamRole;
  /** Display name — the linked X display name, falling back to the account name. */
  name: string | null;
  /** X handle (without @), when the member has X connected. */
  handle: string | null;
  /** Avatar — the member's profile picture, falling back to their X avatar. */
  image: string | null;
};

export type PublicGiveawayDetail = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  prize: string;
  bannerUrl: string | null;
  type: GiveawayType;
  status: GiveawayStatus;
  visibility: GiveawayVisibility;
  chain: Blockchain;
  winnersCount: number;
  startAt: Date;
  endAt: Date;
  hideEntryCount: boolean;
  /** Null when hidden by the creator. */
  entryCount: number | null;
  xAccount: string | null;
  discordServerId: string | null;
  telegram: string | null;
  drawnAt: Date | null;
  team: {
    name: string;
    slug: string;
    logoUrl: string | null;
    xHandle: string | null;
    discordInvite: string | null;
    website: string | null;
  };
  requirements: PublicRequirement[];
  /** The project's public-facing team (founder + admins). */
  teamMembers: PublicTeamMember[];
  /** Present only when the viewer is signed in AND has an entry. */
  viewerEntry: ViewerEntry | null;
};

/**
 * Load a giveaway for its public page. Returns null when the giveaway doesn't
 * exist or isn't viewable (drafts + cancelled are hidden from the public page).
 *
 * PRIVATE/COMMUNITY giveaways ARE returned here (they're reachable by direct
 * link — that's the point of code-gated drops); listing queries still exclude
 * them from the public grid.
 */
export async function getPublicGiveaway(
  slug: string,
  viewerId: string | null
): Promise<PublicGiveawayDetail | null> {
  const g = await db.giveaway.findUnique({
    where: { slug },
    include: {
      team: {
        select: {
          name: true,
          slug: true,
          logoUrl: true,
          xHandle: true,
          discordInvite: true,
          website: true,
          members: {
            // Only the public-facing team (founder + admins), not raffle managers.
            where: { role: { in: ["OWNER", "ADMIN"] } },
            select: {
              role: true,
              user: {
                select: {
                  name: true,
                  image: true,
                  connections: {
                    where: { provider: "twitter" },
                    select: { username: true, displayName: true, avatarUrl: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
      requirements: { orderBy: { order: "asc" } },
      _count: { select: { entries: true } },
    },
  });

  if (!g) return null;
  // Never surface drafts or cancelled giveaways publicly.
  if (g.status === "DRAFT" || g.status === "CANCELLED") return null;

  // The viewer's own entry (if any) + per-requirement progress. Scoped strictly
  // to viewerId, so no other entrant's data is ever loaded.
  let viewerEntry: ViewerEntry | null = null;
  const statusByReq = new Map<string, RequirementStatus>();

  if (viewerId) {
    const entry = await db.entry.findUnique({
      where: { giveawayId_userId: { giveawayId: g.id, userId: viewerId } },
      include: {
        statuses: { select: { requirementId: true, status: true } },
        winner: { select: { rank: true } },
      },
    });
    if (entry) {
      viewerEntry = {
        status: entry.status,
        seq: entry.seq,
        isWinner: Boolean(entry.winner),
        winnerRank: entry.winner?.rank ?? null,
      };
      for (const s of entry.statuses) statusByReq.set(s.requirementId, s.status);
    }
  }

  const requirements: PublicRequirement[] = g.requirements.map((r) => ({
    id: r.id,
    type: r.type,
    required: r.required,
    order: r.order,
    config: readConfig(r),
    viewerStatus: statusByReq.get(r.id) ?? null,
  }));

  // Founder first, then admins. Identity prefers the member's linked X (display
  // name + handle + avatar) so the card matches how they present on X.
  const ROLE_RANK: Record<TeamRole, number> = { OWNER: 0, ADMIN: 1, EDITOR: 2 };
  const teamMembers: PublicTeamMember[] = g.team.members
    .slice()
    .sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role])
    .map((m) => {
      const tw = m.user.connections[0] ?? null;
      return {
        role: m.role,
        name: tw?.displayName ?? m.user.name ?? null,
        handle: tw?.username ?? null,
        image: m.user.image ?? tw?.avatarUrl ?? null,
      };
    });

  return {
    id: g.id,
    slug: g.slug,
    title: g.title,
    description: g.description,
    prize: g.prize,
    bannerUrl: g.bannerUrl,
    type: g.type,
    status: g.status,
    visibility: g.visibility,
    chain: g.chain,
    winnersCount: g.winnersCount,
    startAt: g.startAt,
    endAt: g.endAt,
    hideEntryCount: g.hideEntryCount,
    entryCount: g.hideEntryCount ? null : g._count.entries,
    xAccount: g.xAccount,
    discordServerId: g.discordServerId,
    telegram: g.telegram,
    drawnAt: g.drawnAt,
    team: g.team,
    requirements,
    teamMembers,
    viewerEntry,
  };
}

/**
 * Public winners for a finalized giveaway. Returns only display-safe identity
 * (name / image / masked handle) — never emails or entry internals.
 */
export type PublicWinner = {
  rank: number;
  name: string | null;
  image: string | null;
};

export async function getPublicWinners(giveawayId: string): Promise<PublicWinner[]> {
  const winners = await db.winner.findMany({
    where: { giveawayId },
    orderBy: { rank: "asc" },
    select: {
      rank: true,
      user: { select: { name: true, image: true } },
    },
  });
  return winners.map((w) => ({
    rank: w.rank,
    name: w.user.name,
    image: w.user.image,
  }));
}

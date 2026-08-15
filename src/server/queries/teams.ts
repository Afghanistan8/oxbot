import "server-only";

import { db } from "@/lib/db";
import type { TeamRole } from "@prisma/client";

/**
 * Private, membership-scoped team queries for the founder dashboard.
 * These return richer data than the public queries and must only be called
 * after the caller's membership has been (or will be) verified.
 */

export type TeamListItem = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  role: TeamRole;
  giveawayCount: number;
  memberCount: number;
};

/** All teams the user belongs to, with their role + light stats. */
export async function getTeamsForUser(userId: string): Promise<TeamListItem[]> {
  const memberships = await db.teamMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      team: {
        select: {
          id: true,
          slug: true,
          name: true,
          logoUrl: true,
          _count: { select: { giveaways: true, members: true } },
        },
      },
    },
  });

  return memberships.map((m) => ({
    id: m.team.id,
    slug: m.team.slug,
    name: m.team.name,
    logoUrl: m.team.logoUrl,
    role: m.role,
    giveawayCount: m.team._count.giveaways,
    memberCount: m.team._count.members,
  }));
}

/** Full team detail with members (for the settings/members pages). */
export async function getTeamDetail(slug: string) {
  return db.team.findUnique({
    where: { slug },
    include: {
      members: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      },
      invites: {
        where: { acceptedAt: null },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { giveaways: true, members: true } },
    },
  });
}

export type TeamDetail = NonNullable<Awaited<ReturnType<typeof getTeamDetail>>>;

export type SocialConnectionSummary = {
  provider: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

/** The viewer's own connected X/Discord identities (for "connect to verify" UI). */
export async function getSocialConnectionsForUser(
  userId: string
): Promise<SocialConnectionSummary[]> {
  return db.socialConnection.findMany({
    where: { userId, provider: { in: ["twitter", "discord"] } },
    select: { provider: true, username: true, displayName: true, avatarUrl: true },
  });
}

/**
 * How to label a connected account: the true @handle when we have one,
 * otherwise the provider display name. Returns null when neither is known.
 */
export function connectionLabel(
  c: Pick<SocialConnectionSummary, "username" | "displayName"> | null
): string | null {
  if (!c) return null;
  if (c.username) return `@${c.username}`;
  return c.displayName ?? null;
}

/** The first team a user belongs to (used to default the dashboard). */
export async function getPrimaryTeamSlug(userId: string): Promise<string | null> {
  const m = await db.teamMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { team: { select: { slug: true } } },
  });
  return m?.team.slug ?? null;
}

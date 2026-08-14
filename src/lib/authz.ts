import "server-only";

import { db } from "@/lib/db";
import { roleAtLeast } from "@/lib/constants";
import type { TeamRole } from "@prisma/client";

/**
 * Team authorization helpers.
 *
 * The single choke-point for "can this user act on this team?". Every server
 * action and private query should pass through here so role rules live in one
 * place. Entrant data and team management are gated on membership — never
 * exposed to non-members.
 */

export class AuthzError extends Error {
  constructor(
    message = "You don't have permission to do that.",
    readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" = "FORBIDDEN"
  ) {
    super(message);
    this.name = "AuthzError";
  }
}

export type Membership = { teamId: string; userId: string; role: TeamRole };

/** Return the user's membership for a team, or null if not a member. */
export async function getMembership(
  userId: string,
  teamId: string
): Promise<Membership | null> {
  const m = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { teamId: true, userId: true, role: true },
  });
  return m;
}

/**
 * Require that `userId` is a member of `teamId` with at least `minRole`.
 * Throws {@link AuthzError} otherwise. Returns the membership on success.
 */
export async function requireTeamRole(
  userId: string,
  teamId: string,
  minRole: TeamRole = "EDITOR"
): Promise<Membership> {
  const membership = await getMembership(userId, teamId);
  if (!membership) {
    throw new AuthzError("You're not a member of this team.", "FORBIDDEN");
  }
  if (!roleAtLeast(membership.role, minRole)) {
    throw new AuthzError(
      `This action requires the ${minRole} role or higher.`,
      "FORBIDDEN"
    );
  }
  return membership;
}

/**
 * Resolve a team by slug and require membership. Returns { team, membership }.
 * Throws AuthzError (NOT_FOUND) if the team doesn't exist — we don't leak team
 * existence differently from access, so callers can treat both as 404.
 */
export async function requireTeamBySlug(
  userId: string,
  slug: string,
  minRole: TeamRole = "EDITOR"
) {
  const team = await db.team.findUnique({ where: { slug } });
  if (!team) throw new AuthzError("Team not found.", "NOT_FOUND");
  const membership = await requireTeamRole(userId, team.id, minRole);
  return { team, membership };
}

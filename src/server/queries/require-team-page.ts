import "server-only";

import { notFound } from "next/navigation";

import { requireUserId } from "@/lib/session";
import { requireTeamRole, getMembership, AuthzError } from "@/lib/authz";
import { db } from "@/lib/db";
import type { TeamRole } from "@prisma/client";

/**
 * Page-level team resolver for `/dashboard/[team]/**` routes.
 *
 * Ensures the viewer is signed in (redirect handled upstream by the layout, but
 * we re-assert), loads the team by slug, and verifies membership at `minRole`.
 * Missing team OR insufficient access both 404 — we don't reveal which teams
 * exist to non-members.
 */
export async function resolveTeamPage(slug: string, minRole: TeamRole = "EDITOR") {
  const userId = await requireUserId(`/dashboard/${slug}`);

  const team = await db.team.findUnique({ where: { slug } });
  if (!team) notFound();

  try {
    const membership = await requireTeamRole(userId, team.id, minRole);
    return { userId, team, membership };
  } catch (err) {
    if (err instanceof AuthzError) notFound();
    throw err;
  }
}

/** Like resolveTeamPage but returns the membership (or null) without gating. */
export async function resolveTeamViewer(slug: string) {
  const userId = await requireUserId(`/dashboard/${slug}`);
  const team = await db.team.findUnique({ where: { slug } });
  if (!team) notFound();
  const membership = await getMembership(userId, team.id);
  if (!membership) notFound();
  return { userId, team, membership };
}

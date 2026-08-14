import "server-only";

import { db } from "@/lib/db";
import { slugify } from "@/lib/utils";
import { generateCode } from "@/lib/giveaway/codes";

/**
 * Slug generation with DB-backed uniqueness for teams and giveaways.
 */

/** Ensure a team slug is unique, appending a short suffix on collision. */
export async function uniqueTeamSlug(base: string): Promise<string> {
  const root = slugify(base) || "team";
  return ensureUnique(root, async (slug) => {
    const existing = await db.team.findUnique({
      where: { slug },
      select: { id: true },
    });
    return existing === null;
  });
}

/** Ensure a giveaway slug is unique, appending a short suffix on collision. */
export async function uniqueGiveawaySlug(base: string): Promise<string> {
  const root = slugify(base) || "giveaway";
  return ensureUnique(root, async (slug) => {
    const existing = await db.giveaway.findUnique({
      where: { slug },
      select: { id: true },
    });
    return existing === null;
  });
}

/**
 * Try `root`, then `root-<rand>` until `isFree` returns true. Bounded attempts
 * then falls back to a guaranteed-unique random token.
 */
async function ensureUnique(
  root: string,
  isFree: (slug: string) => Promise<boolean>
): Promise<string> {
  if (await isFree(root)) return root;
  for (let i = 0; i < 5; i++) {
    const candidate = `${root}-${generateCode(4).toLowerCase()}`;
    if (await isFree(candidate)) return candidate;
  }
  return `${root}-${generateCode(8).toLowerCase()}`;
}

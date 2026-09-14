import "server-only";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { AuthzError } from "@/lib/authz";

/**
 * Platform-admin gate for the OxFoxes Collab desk.
 *
 * A platform admin isn't a Team role — it's the person operating oxbot itself
 * (`PLATFORM_ADMIN_EMAILS`), allowed to add a Collab request on behalf of a
 * project that doesn't want to create an oxbot account. There's exactly one
 * operator today, so a fixed email allowlist is enough — no DB flag.
 */

const ADMIN_EMAILS = new Set(
  env.PLATFORM_ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && ADMIN_EMAILS.has(email!.toLowerCase());
}

/** Is the given signed-in user a platform admin? */
export async function isPlatformAdmin(userId: string | null): Promise<boolean> {
  if (!userId || ADMIN_EMAILS.size === 0) return false;
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  return isPlatformAdminEmail(user?.email);
}

/** Require the current user to be a platform admin. Throws {@link AuthzError} otherwise. */
export async function requirePlatformAdmin(userId: string): Promise<void> {
  if (!(await isPlatformAdmin(userId))) {
    throw new AuthzError("Platform-admin access required.", "FORBIDDEN");
  }
}

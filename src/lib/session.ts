import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Server-side session/user helpers used across Server Components + Actions.
 */

/** The current session (or null). */
export async function getSession() {
  return auth();
}

/** The current user's id, or null if signed out. */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** The current user record (or null). */
export async function getCurrentUser() {
  const id = await getCurrentUserId();
  if (!id) return null;
  return db.user.findUnique({ where: { id } });
}

/**
 * Require an authenticated user; redirects to sign-in (with a callback) if not.
 * Returns the user id.
 */
export async function requireUserId(callbackPath = "/dashboard"): Promise<string> {
  const id = await getCurrentUserId();
  if (!id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }
  return id;
}

/** Require an authenticated user record; redirects if not signed in. */
export async function requireUser(callbackPath = "/dashboard") {
  const id = await requireUserId(callbackPath);
  const user = await db.user.findUnique({ where: { id } });
  if (!user) redirect(`/signin?callbackUrl=${encodeURIComponent(callbackPath)}`);
  return user;
}

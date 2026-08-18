import "server-only";

import { db } from "@/lib/db";
import { PLATFORM_FOUNDER_X_HANDLES } from "@/lib/founders";

/**
 * Resolve the configured platform founders (by X handle) into display cards for
 * the landing page — display name, @handle, and avatar pulled live from each
 * founder's linked X account and profile picture.
 */
export type PlatformFounder = {
  role: string;
  name: string | null;
  handle: string | null;
  image: string | null;
};

export async function getPlatformFounders(): Promise<PlatformFounder[]> {
  const handles = PLATFORM_FOUNDER_X_HANDLES.map((h) => h.replace(/^@/, "").toLowerCase());
  if (handles.length === 0) return [];

  const connections = await db.socialConnection.findMany({
    where: { provider: "twitter", username: { in: handles } },
    select: {
      username: true,
      displayName: true,
      avatarUrl: true,
      user: { select: { name: true, image: true } },
    },
  });

  const byHandle = new Map(connections.map((c) => [c.username?.toLowerCase(), c]));

  // Preserve the configured order.
  return handles
    .map((h) => byHandle.get(h))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      role: "Founder",
      name: c.displayName ?? c.user.name ?? null,
      handle: c.username,
      image: c.user.image ?? c.avatarUrl ?? null,
    }));
}

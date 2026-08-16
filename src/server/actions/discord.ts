"use server";

import { requireUserId } from "@/lib/session";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { fetchGuildRoles, type GuildRole } from "@/lib/integrations/discord";

/**
 * Founder-side lookup of a Discord server's real roles, powering the role
 * picker in the giveaway requirement builder. Auth-gated (any signed-in user)
 * and rate-limited; the giveaway action itself re-validates the guild/team
 * relationship, so this is read-only convenience, not a trust boundary.
 */
export async function fetchGuildRolesAction(
  guildId: string
): Promise<{ ok: true; roles: GuildRole[] } | { ok: false; error: string }> {
  const userId = await requireUserId();

  const rl = rateLimit(`discord-roles:${userId}`, RATE_LIMITS.verify.limit, RATE_LIMITS.verify.windowMs);
  if (!rl.success) return { ok: false, error: "Too many attempts. Please slow down." };

  const trimmed = guildId.trim();
  if (!trimmed) return { ok: false, error: "Enter the Discord server ID first." };
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: "That doesn't look like a valid server ID." };

  return fetchGuildRoles(trimmed);
}

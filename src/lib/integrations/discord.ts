import { env, integrations } from "@/lib/env";

/**
 * Discord integration.
 *
 * Live mode: uses a bot token to check guild membership + roles via the Discord
 * REST API. The bot must be a member of the guild being checked.
 * Mock mode: returns success so local entry flows are testable without a bot.
 */

export type DiscordCheckResult = {
  ok: boolean;
  mocked: boolean;
  detail?: string;
  roleIds?: string[];
};

const API = "https://discord.com/api/v10";

/**
 * Result of a guild-member lookup:
 *  - "member": a definitive yes, with their role ids.
 *  - "absent": a definitive no (404) — the user really isn't in the server.
 *  - "error": inconclusive (rate limit, missing intent, bot removed, network).
 *    We must NOT treat this as "not a member" — that would wrongly reject real
 *    members whenever Discord hiccups or the bot is misconfigured.
 */
type MemberLookup =
  | { kind: "member"; roles: string[] }
  | { kind: "absent" }
  | { kind: "error" };

async function fetchGuildMember(
  guildId: string,
  discordUserId: string
): Promise<MemberLookup> {
  try {
    const res = await fetch(
      `${API}/guilds/${guildId}/members/${discordUserId}`,
      {
        headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
        cache: "no-store",
      }
    );
    if (res.status === 404) return { kind: "absent" }; // definitively not a member
    if (!res.ok) {
      console.warn(`[discord] member fetch failed (${res.status}); treating as inconclusive.`);
      return { kind: "error" };
    }
    const json = (await res.json()) as { roles?: string[] };
    return { kind: "member", roles: json.roles ?? [] };
  } catch (e) {
    console.warn("[discord] member fetch error:", e);
    return { kind: "error" };
  }
}

/** Verify that a user is a member of the given guild. */
export async function verifyGuildMember(
  discordUserId: string | null | undefined,
  guildId: string
): Promise<DiscordCheckResult> {
  if (!integrations.discord.botLive) {
    return { ok: true, mocked: true, detail: `Mock: assumed member of ${guildId}` };
  }
  if (!discordUserId) {
    return { ok: false, mocked: false, detail: "No connected Discord account." };
  }
  const member = await fetchGuildMember(guildId, discordUserId);
  if (member.kind === "absent") {
    return { ok: false, mocked: false, detail: "Not a member of the server." };
  }
  if (member.kind === "error") {
    return { ok: true, mocked: true, detail: "Membership check unavailable; allowed." };
  }
  return { ok: true, mocked: false, detail: "Member", roleIds: member.roles };
}

/**
 * Verify that a user holds at least one of `roleIds` in the guild.
 * If `roleIds` is empty, this degrades to a plain membership check.
 */
export async function verifyGuildRoles(
  discordUserId: string | null | undefined,
  guildId: string,
  roleIds: string[]
): Promise<DiscordCheckResult> {
  if (!integrations.discord.botLive) {
    return {
      ok: true,
      mocked: true,
      detail: `Mock: assumed role(s) in ${guildId}`,
      roleIds,
    };
  }
  if (!discordUserId) {
    return { ok: false, mocked: false, detail: "No connected Discord account." };
  }
  const member = await fetchGuildMember(guildId, discordUserId);
  if (member.kind === "absent") {
    return { ok: false, mocked: false, detail: "Not a member of the server." };
  }
  if (member.kind === "error") {
    return { ok: true, mocked: true, detail: "Role check unavailable; allowed." };
  }
  if (roleIds.length === 0) {
    return { ok: true, mocked: false, detail: "Member", roleIds: member.roles };
  }
  const has = member.roles.some((r) => roleIds.includes(r));
  return {
    ok: has,
    mocked: false,
    detail: has ? "Has required role" : "Missing required role",
    roleIds: member.roles,
  };
}

export type GuildRole = { id: string; name: string; color: string };

/**
 * List a guild's assignable roles, for the founder-side role picker (so they
 * pick real role names instead of pasting raw snowflake IDs). Requires the
 * bot to be a member of the guild. `@everyone` and integration-managed roles
 * (bots, boosters, linked accounts) are excluded — not meaningful as a manual
 * entry-requirement gate.
 */
export async function fetchGuildRoles(
  guildId: string
): Promise<{ ok: true; roles: GuildRole[] } | { ok: false; error: string }> {
  if (!integrations.discord.botLive) {
    return { ok: false, error: "The oxbot Discord bot isn't configured in this environment." };
  }
  try {
    const res = await fetch(`${API}/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
      cache: "no-store",
    });
    // Discord returns 404 (not 403) for a guild the bot isn't a member of, so
    // the far more common cause is a missing invite rather than a bad ID.
    if (res.status === 404) {
      return {
        ok: false,
        error: "oxbot isn't in that server yet — invite the bot, or double-check the server ID.",
      };
    }
    if (res.status === 403) {
      return { ok: false, error: "oxbot lacks permission to read roles in that server." };
    }
    if (!res.ok) {
      return { ok: false, error: `Discord returned an error (${res.status}).` };
    }
    const json = (await res.json()) as Array<{
      id: string;
      name: string;
      color: number;
      position: number;
      managed: boolean;
    }>;
    const roles = json
      .filter((r) => r.name !== "@everyone" && !r.managed)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : "#99AAB5",
      }));
    return { ok: true, roles };
  } catch (e) {
    console.warn("[discord] fetchGuildRoles error:", e);
    return { ok: false, error: "Could not reach Discord. Try again." };
  }
}

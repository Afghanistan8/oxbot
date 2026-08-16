import { env, integrations } from "@/lib/env";

/**
 * Shared "invite the oxbot bot" link builder — used on the project settings
 * page and the /guide page, so the permission set can't drift between them.
 *
 * Bits: Manage Roles (0x10000000) + View Channels (0x400) = 268436480.
 * View Channels is required alongside Manage Roles — verified against a real
 * Discord server; Manage Roles alone left the bot unable to resolve the
 * guild's channel list on some servers.
 */
const DISCORD_BOT_PERMISSIONS = "268436480";

export function discordBotInviteUrl(): string | null {
  if (!integrations.discord.oauthLive) return null;
  const params = new URLSearchParams({
    client_id: env.AUTH_DISCORD_ID,
    permissions: DISCORD_BOT_PERMISSIONS,
    scope: "bot applications.commands",
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

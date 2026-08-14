import { resolveTeamPage } from "@/server/queries/require-team-page";
import { getSocialConnectionsForUser } from "@/server/queries/teams";
import { getCurrentUserId } from "@/lib/session";
import { env, integrations } from "@/lib/env";
import { PageHeader } from "@/components/dashboard/page-header";
import { TeamSettingsForm } from "@/components/dashboard/team-settings-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Project settings" };

// Discord "Manage Roles" permission bit — the minimum needed to verify guild
// membership/roles and assign winner roles once the bot is invited.
const DISCORD_BOT_PERMISSIONS = "268435456";

function discordBotInviteUrl(): string | null {
  if (!integrations.discord.oauthLive) return null;
  const params = new URLSearchParams({
    client_id: env.AUTH_DISCORD_ID,
    permissions: DISCORD_BOT_PERMISSIONS,
    scope: "bot applications.commands",
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

/**
 * Project settings — brand, socials, chains, mint details. Requires ADMIN or OWNER.
 */
export default async function TeamSettingsPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team: slug } = await params;
  const { team } = await resolveTeamPage(slug, "ADMIN");

  const userId = await getCurrentUserId();
  const connections = userId ? await getSocialConnectionsForUser(userId) : [];
  const twitterConnection = connections.find((c) => c.provider === "twitter") ?? null;
  const discordConnection = connections.find((c) => c.provider === "discord") ?? null;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Project settings"
        description="Your public brand, socials, and supported chains."
      />
      <Card>
        <CardContent className="pt-6">
          <TeamSettingsForm
            team={team}
            twitterConnection={twitterConnection}
            discordConnection={discordConnection}
            twitterOauthLive={integrations.twitter.oauthLive}
            discordOauthLive={integrations.discord.oauthLive}
            discordBotInviteUrl={discordBotInviteUrl()}
            callbackUrl={`/dashboard/${slug}/settings`}
          />
        </CardContent>
      </Card>
    </div>
  );
}

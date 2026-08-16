import { resolveTeamPage } from "@/server/queries/require-team-page";
import { getSocialConnectionsForUser } from "@/server/queries/teams";
import { getCurrentUserId } from "@/lib/session";
import { integrations } from "@/lib/env";
import { discordBotInviteUrl } from "@/lib/discord-invite";
import { PageHeader } from "@/components/dashboard/page-header";
import { TeamSettingsForm } from "@/components/dashboard/team-settings-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Project settings" };

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

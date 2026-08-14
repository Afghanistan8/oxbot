import Link from "next/link";
import { Plus, Gift } from "lucide-react";

import { resolveTeamPage } from "@/server/queries/require-team-page";
import { getTeamGiveaways } from "@/server/queries/dashboard";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashboardGiveawayRow } from "@/components/dashboard/giveaway-row";
import { Button } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team } = await params;
  return { title: `${team} · Giveaways` };
}

/**
 * Giveaways list — every giveaway for the team, newest first. Any member (EDITOR+)
 * can view; entry counts here are the real, private numbers.
 */
export default async function GiveawaysListPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team: slug } = await params;
  const { team } = await resolveTeamPage(slug);
  const giveaways = await getTeamGiveaways(team.id);

  return (
    <>
      <PageHeader title="Giveaways" description="Create, manage, and draw winners.">
        <Button asChild size="sm">
          <Link href={`/dashboard/${slug}/giveaways/new`}>
            <Plus className="h-4 w-4" />
            New giveaway
          </Link>
        </Button>
      </PageHeader>

      {giveaways.length > 0 ? (
        <div className="space-y-3">
          {giveaways.map((g) => (
            <DashboardGiveawayRow key={g.id} giveaway={g} teamSlug={slug} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/30 px-6 py-16 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-crimson-gradient shadow-glow-red">
            <Gift className="h-6 w-6 text-white" />
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold text-white">
            No giveaways yet
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Launch your first raffle, first-come drop, or code-gated reward.
          </p>
          <Button asChild className="mt-5">
            <Link href={`/dashboard/${slug}/giveaways/new`}>
              <Plus className="h-4 w-4" />
              Create giveaway
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}

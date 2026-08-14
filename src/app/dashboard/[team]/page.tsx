import Link from "next/link";
import { Gift, Users, Trophy, Radio, Plus, ArrowRight, Settings } from "lucide-react";

import { resolveTeamPage } from "@/server/queries/require-team-page";
import { getTeamStats, getTeamGiveaways, getTeamAuditLog } from "@/server/queries/dashboard";
import { formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashboardGiveawayRow } from "@/components/dashboard/giveaway-row";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { Button } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team } = await params;
  return { title: `${team} · Overview` };
}

/**
 * Team overview — headline stats + recent giveaways. Any member can view.
 */
export default async function TeamOverviewPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team: slug } = await params;
  const { team } = await resolveTeamPage(slug);

  const [stats, giveaways, activity] = await Promise.all([
    getTeamStats(team.id),
    getTeamGiveaways(team.id),
    getTeamAuditLog(team.id, 12),
  ]);
  const recent = giveaways.slice(0, 5);

  return (
    <>
      <PageHeader title={team.name} description={team.description ?? "Project overview"}>
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/${slug}/settings`}>
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href={`/dashboard/${slug}/giveaways/new`}>
            <Plus className="h-4 w-4" />
            New giveaway
          </Link>
        </Button>
      </PageHeader>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Gift} label="Giveaways" value={formatNumber(stats.totalGiveaways)} />
        <StatCard icon={Radio} label="Live now" value={formatNumber(stats.activeGiveaways)} accent />
        <StatCard icon={Users} label="Total entries" value={formatNumber(stats.totalEntries)} />
        <StatCard icon={Trophy} label="Winners drawn" value={formatNumber(stats.totalWinners)} />
      </div>

      {/* Recent giveaways */}
      <div className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-white">Recent giveaways</h2>
          {giveaways.length > 5 && (
            <Link
              href={`/dashboard/${slug}/giveaways`}
              className="inline-flex items-center gap-1 text-sm text-scarlet-soft hover:text-white"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {recent.length > 0 ? (
          <div className="space-y-3">
            {recent.map((g) => (
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
      </div>

      {/* Recent activity */}
      <div className="mt-10">
        <h2 className="mb-4 font-display text-xl font-semibold text-white">Recent activity</h2>
        <ActivityFeed entries={activity} />
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: typeof Gift;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card bg-card-glow p-5 shadow-card">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={accent ? "h-4 w-4 text-scarlet-soft" : "h-4 w-4"} />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums text-white">
        {value}
      </p>
    </div>
  );
}

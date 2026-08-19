import { Users, Gift, Trophy, ChartBar } from "lucide-react";

import { resolveTeamPage } from "@/server/queries/require-team-page";
import { getTeamEntryStats, type EntryStatsRange } from "@/server/queries/dashboard";
import { formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { EntryStatsRangeTabs } from "@/components/dashboard/entry-stats-range-tabs";
import { EntryTrendChart } from "@/components/dashboard/entry-trend-chart";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team } = await params;
  return { title: `${team} · Analytics` };
}

const RANGE_LABEL: Record<EntryStatsRange, string> = {
  week: "the last 7 days",
  month: "the last 30 days",
  year: "the last 12 months",
};

/**
 * Analytics — entry trends per giveaway, with a weekly/monthly/yearly view.
 * Any member can view (read-only, no mutation).
 */
export default async function TeamAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ team: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { team: slug } = await params;
  const { team } = await resolveTeamPage(slug);
  const { range: rawRange } = await searchParams;
  const range: EntryStatsRange =
    rawRange === "month" || rawRange === "year" ? rawRange : "week";

  const stats = await getTeamEntryStats(team.id, range);

  return (
    <>
      <PageHeader title="Analytics" description="Entries per giveaway, over time." />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Showing completed entries from {RANGE_LABEL[range]}.
        </p>
        <EntryStatsRangeTabs active={range} />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Entries this period" value={formatNumber(stats.totalInRange)} accent />
        <StatCard icon={ChartBar} label="Entries all-time" value={formatNumber(stats.totalAllTime)} />
        <StatCard icon={Gift} label="Giveaways tracked" value={formatNumber(stats.series.length)} />
        <StatCard
          icon={Trophy}
          label="Top giveaway"
          value={stats.topGiveaway ? formatNumber(stats.topGiveaway.total) : "—"}
          sub={stats.topGiveaway?.title}
        />
      </div>

      {/* Trend chart */}
      <div className="mt-8 rounded-2xl border border-border bg-card bg-card-glow p-6 shadow-card">
        <h2 className="mb-1 font-display text-lg font-semibold text-white">
          Entries by giveaway
        </h2>
        <p className="mb-5 text-xs text-muted-foreground">
          Stacked by giveaway — each color is one project&apos;s share of entries per{" "}
          {range === "year" ? "month" : "day"}.
        </p>
        <EntryTrendChart series={stats.series} points={stats.points} />
      </div>

      {/* Leaderboard */}
      {stats.series.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 font-display text-lg font-semibold text-white">
            Entries by giveaway (this period)
          </h2>
          <div className="space-y-2">
            {stats.series
              .slice()
              .sort((a, b) => b.total - a.total)
              .map((s) => {
                const max = Math.max(...stats.series.map((x) => x.total), 1);
                const pct = Math.round((s.total / max) * 100);
                return (
                  <div
                    key={s.key}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-3"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                      {s.title}
                    </span>
                    <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-ink-black/60 sm:block">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                      {formatNumber(s.total)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = false,
}: {
  icon: typeof Gift;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card bg-card-glow p-5 shadow-card">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={accent ? "h-4 w-4 text-scarlet-soft" : "h-4 w-4"} />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums text-white">{value}</p>
      {sub && <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

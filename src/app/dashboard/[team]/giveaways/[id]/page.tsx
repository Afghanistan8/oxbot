import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  ExternalLink,
  Users,
  Trophy,
  KeyRound,
  CheckCircle2,
  Calendar,
  Lock,
  ListChecks,
  Download,
} from "lucide-react";

import { resolveTeamPage } from "@/server/queries/require-team-page";
import {
  getManagedGiveaway,
  getGiveawayEntrants,
  getGiveawayWinners,
  type ManagedRequirement,
} from "@/server/queries/dashboard";
import { roleAtLeast, GIVEAWAY_TYPE_META, GIVEAWAY_VISIBILITY_META, REQUIREMENT_META } from "@/lib/constants";
import { giveawayPhase, PHASE_META } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { formatNumber, cn, absoluteUrl } from "@/lib/utils";
import { brand } from "@/lib/brand";
import { PageHeader } from "@/components/dashboard/page-header";
import { GiveawayActions } from "@/components/dashboard/giveaway-actions";
import { CopyLinkButton } from "@/components/dashboard/copy-link-button";
import { ChainBadge } from "@/components/giveaway/chain-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WinnersPanel } from "@/components/dashboard/winners-panel";
import { EntrantsTable } from "@/components/dashboard/entrants-table";
import type { EntryStatus } from "@prisma/client";

export const metadata = { title: "Giveaway" };

/**
 * Giveaway management page — private summary + lifecycle controls. Entry counts
 * shown here are the real (private) numbers, visible only to team members.
 * Entrant tables + winner drawing are added in the winners phase.
 */
export default async function ManageGiveawayPage({
  params,
  searchParams,
}: {
  params: Promise<{ team: string; id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { team: slug, id } = await params;
  const { status: statusParam } = await searchParams;
  const { team, membership } = await resolveTeamPage(slug);
  const giveaway = await getManagedGiveaway(team.id, id);
  if (!giveaway) notFound();

  const phase = giveawayPhase(giveaway);
  const phaseMeta = PHASE_META[phase];
  const typeMeta = GIVEAWAY_TYPE_META[giveaway.type];
  const canAdmin = roleAtLeast(membership.role, "ADMIN");
  const canManage = roleAtLeast(membership.role, "EDITOR");
  const isPublicable = giveaway.visibility !== "PRIVATE" && phase !== "draft";

  const statusFilter = parseStatusFilter(statusParam);
  const [entrants, winners] = await Promise.all([
    getGiveawayEntrants(id, statusFilter ? { status: statusFilter } : {}),
    getGiveawayWinners(id),
  ]);

  return (
    <div className="max-w-6xl">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground">
        <Link href={`/dashboard/${slug}/giveaways`}>
          <ArrowLeft className="h-4 w-4" />
          Back to giveaways
        </Link>
      </Button>

      <PageHeader title={giveaway.title} description={giveaway.prize}>
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/${slug}/giveaways/${id}/edit`}>
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        </Button>
      </PageHeader>

      {/* Status + meta row */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant={phaseMeta.badge}>{phaseMeta.label}</Badge>
        <span className="text-sm text-scarlet-soft/80">{typeMeta.label}</span>
        <ChainBadge chain={giveaway.chain} />
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          {giveaway.visibility === "PRIVATE" && <Lock className="h-3 w-3" />}
          {GIVEAWAY_VISIBILITY_META[giveaway.visibility].label}
        </span>
        {isPublicable && (
          <>
            <Link
              href={`/giveaways/${giveaway.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-xs text-scarlet-soft hover:text-white"
            >
              View public page <ExternalLink className="h-3 w-3" />
            </Link>
            <CopyLinkButton url={absoluteUrl(`/giveaways/${giveaway.slug}`)} />
          </>
        )}
      </div>

      {/* Lifecycle actions */}
      <div className="mb-8">
        <GiveawayActions giveawayId={giveaway.id} status={giveaway.status} canAdmin={canAdmin} />
      </div>

      {/* Private stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Total entries" value={formatNumber(giveaway.entryCount)} />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={formatNumber(giveaway.completedCount)}
        />
        <StatCard
          icon={Trophy}
          label="Winners"
          value={`${giveaway.winnerCount}/${giveaway.winnersCount}`}
        />
        {giveaway.type === "CODE" ? (
          <StatCard icon={KeyRound} label="Codes" value={formatNumber(giveaway.codeCount)} />
        ) : (
          <StatCard
            icon={giveaway.hideEntryCount ? Lock : Users}
            label="Public count"
            value={giveaway.hideEntryCount ? "Hidden" : "Shown"}
          />
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card/40 px-4 py-3 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0 text-scarlet-soft" />
        Entrant details are private to your team and never shown publicly.
      </div>

      {/* Winners */}
      {phase !== "draft" && (
        <div className="mt-8">
          <WinnersPanel
            giveawayId={giveaway.id}
            teamSlug={slug}
            phase={phase}
            type={giveaway.type}
            winnersCount={giveaway.winnersCount}
            completedCount={giveaway.completedCount}
            winners={winners}
            drawnAt={giveaway.drawnAt}
            drawSeed={giveaway.drawSeed}
            canManage={canManage}
          />
        </div>
      )}

      {/* Schedule */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Starts" value={<LocalTime value={giveaway.startAt} />} />
            {giveaway.type === "FCFS" ? (
              <Row
                label="Ends"
                value={`When all ${giveaway.winnersCount} slots are claimed (${giveaway.fcfsCursor}/${giveaway.winnersCount})`}
              />
            ) : (
              <Row label="Ends" value={<LocalTime value={giveaway.endAt} />} />
            )}
            {giveaway.drawnAt && <Row label="Drawn" value={<LocalTime value={giveaway.drawnAt} />} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              Entry requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {giveaway.requirements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requirements — open entry.</p>
            ) : (
              <ul className="space-y-2">
                {giveaway.requirements.map((r) => (
                  <li key={r.id} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="text-white">
                      {REQUIREMENT_META[r.type].label}
                      <span className="text-muted-foreground">
                        {requirementDetail(r)}
                        {!r.required && " · optional"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {giveaway.description && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {giveaway.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Private entrants */}
      <div className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">Entrants</h2>
            <p className="text-sm text-muted-foreground">
              Private to your team · {formatNumber(giveaway.entryCount)} total
            </p>
          </div>
          {giveaway.entryCount > 0 && (
            <Button asChild variant="outline" size="sm">
              <a href={`/dashboard/${slug}/giveaways/${id}/export`}>
                <Download className="h-4 w-4" />
                Export CSV
              </a>
            </Button>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {ENTRY_FILTERS.map((f) => {
            const active = (statusFilter ?? "all") === f.value;
            const href =
              f.value === "all"
                ? `/dashboard/${slug}/giveaways/${id}`
                : `/dashboard/${slug}/giveaways/${id}?status=${f.value}`;
            return (
              <Link
                key={f.value}
                href={href}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/40 bg-primary/15 text-scarlet-soft"
                    : "border-border text-muted-foreground hover:text-white"
                )}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        <EntrantsTable
          entrants={entrants}
          requirements={giveaway.requirements}
          canManage={canManage}
        />
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        {brand.name} · giveaway {giveaway.slug}
      </p>
    </div>
  );
}

const ENTRY_FILTERS: { label: string; value: EntryStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Pending", value: "PENDING" },
  { label: "Disqualified", value: "DISQUALIFIED" },
];

function parseStatusFilter(v: string | undefined): EntryStatus | null {
  if (v === "COMPLETED" || v === "PENDING" || v === "DISQUALIFIED") return v;
  return null;
}

/** A short human summary of a requirement's config for the list. */
function requirementDetail(r: ManagedRequirement): string {
  const c = r.config;
  switch (r.type) {
    case "TWITTER_FOLLOW":
      return typeof c.handle === "string" && c.handle ? ` — @${c.handle}` : "";
    case "TWITTER_LIKE":
    case "TWITTER_RETWEET":
      return typeof c.tweetUrl === "string" && c.tweetUrl ? " — a post" : "";
    case "DISCORD_ROLE": {
      const n = Array.isArray(c.roleIds) ? c.roleIds.length : 0;
      return n ? ` — ${n} role${n === 1 ? "" : "s"}` : "";
    }
    case "CODE":
      return c.caseSensitive ? " — case-sensitive" : "";
    case "WALLET":
      return typeof c.chain === "string" && c.chain ? ` — ${c.chain}` : "";
    default:
      return "";
  }
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card bg-card-glow p-5 shadow-card">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}

import Link from "next/link";
import { ArrowRight, ExternalLink, Inbox, Layers, Plus, Send, Ticket } from "lucide-react";

import { resolveTeamPage } from "@/server/queries/require-team-page";
import { getCollabOverview, getIncomingRequests, getTeamListings } from "@/server/queries/collab";
import { RequestsTable } from "@/components/collab/requests-table";
import { collabEntryUrl } from "@/lib/collab/surface";
import { formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { DashboardListingRow } from "@/components/collab/listing-row";
import { CollabEmptyState } from "@/components/collab/collab-empty-state";

export async function generateMetadata({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  return { title: `${team} · Collab` };
}

/**
 * Collab desk overview — inventory, incoming + outgoing requests, and public
 * raffles at a glance. Any member can view.
 */
export default async function CollabOverviewPage({ params }: { params: Promise<{ team: string }> }) {
  const { team: slug } = await params;
  const { team } = await resolveTeamPage(slug, "COLLAB_MANAGER");
  const base = `/dashboard/${slug}/collab`;

  const [overview, listings, incoming] = await Promise.all([
    getCollabOverview(team.id),
    getTeamListings(team.id),
    getIncomingRequests(team.id, { filter: "open" }),
  ]);
  const recentListings = listings.slice(0, 4);

  return (
    <>
      <PageHeader title="Collab desk" description="Whitelist inventory, partner requests, and public raffles.">
        <Button asChild variant="outline" size="sm">
          <a href={collabEntryUrl("/listings")} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Browse the desk
          </a>
        </Button>
        <Button asChild size="sm">
          <Link href={`${base}/listings/new`}>
            <Plus className="h-4 w-4" />
            New listing
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Layers}
          label="Open listings"
          value={formatNumber(overview.listings.open)}
          sub={`${formatNumber(overview.spots.available)} partner spots free`}
        />
        <StatCard
          icon={Inbox}
          label="To review"
          value={formatNumber(overview.incoming.open)}
          sub={`${formatNumber(overview.incoming.total)} requests all-time`}
          accent={overview.incoming.open > 0}
          href={`${base}/requests`}
        />
        <StatCard
          icon={Send}
          label="Outgoing"
          value={formatNumber(overview.outgoing.open)}
          sub={`${formatNumber(overview.outgoing.approvedSpots)} spots received`}
          href={`${base}/outgoing`}
        />
        <StatCard
          icon={Ticket}
          label="Live raffles"
          value={formatNumber(overview.publicRaffles.live)}
          sub={`${formatNumber(overview.spots.public)} public spots`}
          href={`${base}/raffles`}
        />
      </div>

      {incoming.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-white">Waiting on you</h2>
            <Link href={`${base}/requests`} className="inline-flex items-center gap-1 text-sm text-scarlet-soft hover:text-white">
              Review queue <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <RequestsTable requests={incoming.slice(0, 5)} teamSlug={slug} />
        </section>
      )}

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-white">Your inventory</h2>
          {listings.length > recentListings.length && (
            <Link href={`${base}/listings`} className="inline-flex items-center gap-1 text-sm text-scarlet-soft hover:text-white">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        {recentListings.length > 0 ? (
          <div className="space-y-3">
            {recentListings.map((l) => (
              <DashboardListingRow key={l.id} listing={l} teamSlug={slug} />
            ))}
          </div>
        ) : (
          <CollabEmptyState
            icon={Layers}
            title="Nothing listed yet"
            body="Post whitelist spots for partner communities — and carve out a public raffle if you want one."
            action={{ href: `${base}/listings/new`, label: "List inventory" }}
          />
        )}
      </section>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = false,
  href,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  href?: string;
}) {
  const body = (
    <div className="h-full rounded-2xl border border-border bg-card bg-card-glow p-5 shadow-card transition-colors hover:border-primary/40">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className={accent ? "h-4 w-4 text-scarlet-soft" : "h-4 w-4"} />
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 font-display text-3xl font-bold tabular-nums text-white">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

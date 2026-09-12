import Link from "next/link";
import { Download, Inbox } from "lucide-react";

import { resolveTeamPage } from "@/server/queries/require-team-page";
import { getIncomingRequests, getTeamListings, type IncomingFilter } from "@/server/queries/collab";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { RequestsTable } from "@/components/collab/requests-table";
import { CollabEmptyState } from "@/components/collab/collab-empty-state";

export const metadata = { title: "Incoming requests" };

const FILTERS: { key: IncomingFilter; label: string }[] = [
  { key: "open", label: "To review" },
  { key: "approved", label: "Approved" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];

/** The review queue: every request filed against this team's listings. */
export default async function IncomingRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ team: string }>;
  searchParams: Promise<{ filter?: string; listing?: string }>;
}) {
  const [{ team: slug }, sp] = await Promise.all([params, searchParams]);
  const { team } = await resolveTeamPage(slug);
  const filter = (FILTERS.find((f) => f.key === sp.filter)?.key ?? "open") as IncomingFilter;
  const listingId = sp.listing || undefined;

  const [requests, listings] = await Promise.all([
    getIncomingRequests(team.id, { filter, listingId }),
    getTeamListings(team.id),
  ]);
  const base = `/dashboard/${slug}/collab/requests`;
  const qs = (f: IncomingFilter, l?: string) => {
    const p = new URLSearchParams();
    if (f !== "open") p.set("filter", f);
    if (l) p.set("listing", l);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <>
      <PageHeader title="Incoming requests" description="Partners asking for your whitelist spots. Private to your team.">
        <Button asChild variant="outline" size="sm">
          <a href={`/dashboard/${slug}/collab/allocations/export${listingId ? `?listing=${listingId}` : ""}`}>
            <Download className="h-4 w-4" />
            Export allocations
          </a>
        </Button>
      </PageHeader>

      {listings.length === 0 ? (
        <CollabEmptyState
          icon={Inbox}
          title="No listings, no requests"
          body="Requests arrive once you list whitelist inventory on the desk."
          action={{ href: `/dashboard/${slug}/collab/listings/new`, label: "List inventory" }}
        />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={qs(f.key, listingId)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                    filter === f.key
                      ? "border-primary/60 bg-primary/15 text-white shadow-glow-red"
                      : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-white"
                  )}
                >
                  {f.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={qs(filter)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                  !listingId ? "border-primary/50 text-white" : "border-border text-muted-foreground hover:text-white"
                )}
              >
                All listings
              </Link>
              {listings.slice(0, 6).map((l) => (
                <Link
                  key={l.id}
                  href={qs(filter, l.id)}
                  className={cn(
                    "max-w-[12rem] truncate rounded-full border px-3 py-1.5 text-xs transition-colors",
                    listingId === l.id ? "border-primary/50 text-white" : "border-border text-muted-foreground hover:text-white"
                  )}
                >
                  {l.title}
                </Link>
              ))}
            </div>
          </div>
          <RequestsTable requests={requests} teamSlug={slug} />
        </>
      )}
    </>
  );
}

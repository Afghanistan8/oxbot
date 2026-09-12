import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, ExternalLink, Inbox, ListChecks, Lock, Pencil, StickyNote } from "lucide-react";

import { resolveTeamPage } from "@/server/queries/require-team-page";
import { getManagedListing } from "@/server/queries/collab";
import { roleAtLeast } from "@/lib/constants";
import {
  ALLOCATION_STATUS_META,
  LISTING_PHASE_META,
  METHOD_META,
  REQUEST_STATUS_META,
  listingPhase,
} from "@/lib/collab/constants";
import { criteriaRows } from "@/lib/collab/format";
import { collabShareUrl } from "@/lib/collab/surface";
import { formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { CopyLinkButton } from "@/components/dashboard/copy-link-button";
import { LocalTime } from "@/components/local-time";
import { ChainBadge } from "@/components/giveaway/chain-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssetTypeChip, MethodChip } from "@/components/collab/collab-chips";
import { InventoryBar } from "@/components/collab/inventory-bar";
import { ListingActions } from "@/components/collab/listing-actions";
import type { AllocationStatus, RequestStatus } from "@prisma/client";

export async function generateMetadata({ params }: { params: Promise<{ team: string; id: string }> }) {
  const { team } = await params;
  return { title: `${team} · Collab listing` };
}

/** Listing management — inventory, criteria, request pipeline, lifecycle. */
export default async function ManageListingPage({ params }: { params: Promise<{ team: string; id: string }> }) {
  const { team: slug, id } = await params;
  const { team, membership } = await resolveTeamPage(slug);
  const listing = await getManagedListing(team.id, id);
  if (!listing) notFound();

  const phase = listingPhase(listing);
  const phaseMeta = LISTING_PHASE_META[phase];
  const canAdmin = roleAtLeast(membership.role, "ADMIN");
  const publicUrl = collabShareUrl(`/listings/${listing.slug}`);
  const rows = criteriaRows(listing.criteria);
  const base = `/dashboard/${slug}/collab`;

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
        <Link href={`${base}/listings`}>
          <ArrowLeft className="h-4 w-4" />
          Back to listings
        </Link>
      </Button>

      <PageHeader title={listing.title} description={METHOD_META[listing.distributionMethod].label}>
        {listing.status !== "CANCELLED" && (
          <Button asChild variant="outline" size="sm">
            <Link href={`${base}/listings/${id}/edit`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
        )}
        {listing.status !== "DRAFT" && (
          <Button asChild variant="outline" size="sm">
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              View
            </a>
          </Button>
        )}
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={phaseMeta.badge}>{phaseMeta.label}</Badge>
          <MethodChip method={listing.distributionMethod} />
          <AssetTypeChip assetType={listing.assetType} />
          <ChainBadge chain={listing.chain} />
          {listing.visibility === "PRIVATE" && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Private
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {listing.status !== "DRAFT" && <CopyLinkButton url={publicUrl} />}
          <ListingActions listingId={listing.id} status={listing.status} canAdmin={canAdmin} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <InventoryBar listing={listing} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Mini label="Total" value={formatNumber(listing.totalSpots)} />
                <Mini label="Available" value={formatNumber(listing.available)} accent />
                <Mini label="Granted" value={formatNumber(listing.reservedSpots + listing.allocatedSpots)} />
                <Mini label="Public raffle" value={formatNumber(listing.publicSpots)} />
              </div>
              <p className="text-xs text-muted-foreground">
                Partners may request {formatNumber(listing.spotsPerRequestMin)}–{formatNumber(listing.spotsPerRequestMax)} spots each.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Inbox className="h-4 w-4 text-scarlet-soft" />
                Requests
              </CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link href={`${base}/requests?listing=${listing.id}`}>Review queue</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {listing.requestCount === 0 ? (
                <p className="text-sm text-muted-foreground">No requests yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(listing.requestStatusCounts) as [RequestStatus, number][]).map(([status, count]) => (
                    <Badge key={status} variant={REQUEST_STATUS_META[status].badge}>
                      {REQUEST_STATUS_META[status].label} · {count}
                    </Badge>
                  ))}
                </div>
              )}
              {Object.keys(listing.allocationCounts).length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  {(Object.entries(listing.allocationCounts) as [AllocationStatus, { count: number; spots: number }][]).map(
                    ([status, v]) => (
                      <Badge key={status} variant={ALLOCATION_STATUS_META[status].badge}>
                        {ALLOCATION_STATUS_META[status].label} · {v.count} teams · {formatNumber(v.spots)} spots
                      </Badge>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-scarlet-soft" />
                Window
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Opens" value={<LocalTime value={listing.startAt} />} />
              <Row label="Closes" value={<LocalTime value={listing.endAt} />} />
              {listing.mintOrTgeAt && (
                <Row label={listing.assetType === "TOKEN" ? "TGE" : "Mint"} value={<LocalTime value={listing.mintOrTgeAt} />} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-scarlet-soft" />
                Criteria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {rows.length === 0 ? (
                <p className="text-muted-foreground">Open to every project.</p>
              ) : (
                rows.map((r) => <Row key={r.label} label={r.label} value={r.value} />)
              )}
            </CardContent>
          </Card>

          {listing.notesPrivate && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <StickyNote className="h-4 w-4 text-scarlet-soft" />
                  Private notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-foreground/85">{listing.notesPrivate}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Mini({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={accent ? "mt-1 font-display text-xl font-bold text-scarlet-soft" : "mt-1 font-display text-xl font-bold text-white"}>
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  );
}

import Link from "next/link";
import { Layers, Inbox, Ticket, Lock } from "lucide-react";

import type { DashboardListing } from "@/server/queries/collab";
import { LISTING_PHASE_META, listingPhase } from "@/lib/collab/constants";
import { formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ChainBadge } from "@/components/giveaway/chain-badge";
import { MethodChip } from "@/components/collab/collab-chips";
import { InventoryBar } from "@/components/collab/inventory-bar";

/** DashboardListingRow — compact founder-side row linking into listing management. */
export function DashboardListingRow({ listing, teamSlug }: { listing: DashboardListing; teamSlug: string }) {
  const phase = listingPhase(listing);
  const phaseMeta = LISTING_PHASE_META[phase];

  return (
    <Link
      href={`/dashboard/${teamSlug}/collab/listings/${listing.id}`}
      className="group flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-4 transition-all duration-200 hover:border-primary/50 hover:bg-card sm:flex-row sm:items-center"
    >
      <div className="relative hidden h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-ink-charcoal sm:block">
        {listing.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-crimson-gradient/20">
            <Layers className="h-5 w-5 text-primary/40" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={phaseMeta.badge}>{phaseMeta.label}</Badge>
          <MethodChip method={listing.distributionMethod} />
          <ChainBadge chain={listing.chain} showLabel={false} />
          {listing.visibility === "PRIVATE" && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Private
            </span>
          )}
        </div>
        <h3 className="truncate font-display text-base font-semibold text-white">{listing.title}</h3>
        <InventoryBar listing={listing} showLegend={false} className="max-w-md" />
      </div>

      <div className="flex shrink-0 items-center gap-5 text-xs text-muted-foreground">
        <Stat icon={Layers} label="available" value={`${formatNumber(listing.available)}/${formatNumber(listing.totalSpots)}`} />
        <Stat icon={Inbox} label="to review" value={formatNumber(listing.openRequestCount)} highlight={listing.openRequestCount > 0} />
        {listing.publicRaffle && <Stat icon={Ticket} label="raffle" value={listing.publicRaffle.status.toLowerCase()} />}
      </div>
    </Link>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: typeof Layers;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-right">
      <p className={highlight ? "inline-flex items-center gap-1 font-semibold text-scarlet-soft" : "inline-flex items-center gap-1 font-semibold text-white"}>
        <Icon className="h-3.5 w-3.5" />
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wider">{label}</p>
    </div>
  );
}

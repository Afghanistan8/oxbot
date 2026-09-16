import Link from "next/link";
import { CalendarClock, ExternalLink, MessageSquare, Send } from "lucide-react";

import { resolveTeamPage } from "@/server/queries/require-team-page";
import { getOutgoingRequests, type OutgoingRequestRow } from "@/server/queries/collab";
import {
  ALLOCATION_STATUS_META,
  OPEN_REQUEST_STATUSES,
  REQUEST_STATUS_META,
} from "@/lib/collab/constants";
import { collabEntryUrl } from "@/lib/collab/surface";
import { CHAIN_META } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { LocalTime } from "@/components/local-time";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChainBadge } from "@/components/giveaway/chain-badge";
import { CollabEmptyState } from "@/components/collab/collab-empty-state";
import {
  AllocationWalletsForm,
  RequestReplyForm,
  WithdrawRequestButton,
} from "@/components/collab/outgoing-actions";

export const metadata = { title: "Outgoing requests" };

/** Requests this team filed with other projects, plus granted spots and delivery. */
export default async function OutgoingRequestsPage({ params }: { params: Promise<{ team: string }> }) {
  const { team: slug } = await params;
  const { team } = await resolveTeamPage(slug, "COLLAB_MANAGER");
  const requests = await getOutgoingRequests(team.id);

  const secured = requests.reduce(
    (n, r) => n + (r.allocation && r.allocation.status !== "REVOKED" ? r.allocation.spots : 0),
    0
  );

  return (
    <>
      <PageHeader
        title="Outgoing requests"
        description={
          requests.length
            ? `${formatNumber(secured)} whitelist spots secured across ${requests.length} request${requests.length === 1 ? "" : "s"}.`
            : "Whitelist spots your project has asked other teams for."
        }
      >
        <Button asChild size="sm">
          <a href={collabEntryUrl("/listings")} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Browse listings
          </a>
        </Button>
      </PageHeader>

      {requests.length === 0 ? (
        <CollabEmptyState
          icon={Send}
          title="No requests yet"
          body="Find a listing on the Collab desk and pitch your community for spots."
        />
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <OutgoingCard key={r.id} request={r} />
          ))}
        </div>
      )}
    </>
  );
}

function OutgoingCard({ request: r }: { request: OutgoingRequestRow }) {
  const meta = REQUEST_STATUS_META[r.status];
  const alloc = r.allocation;
  const isOpen = OPEN_REQUEST_STATUSES.includes(r.status);
  const declinable = (r.status === "APPROVED" || r.status === "PARTIALLY_APPROVED") && alloc?.status === "RESERVED";
  const walletsText = alloc?.wallets.map((w) => (w.label ? `${w.address}, ${w.label}` : w.address)).join("\n") ?? "";
  // A submission the listing team sent back: spots still RESERVED, but a review
  // note and a prior submission (raffle link) are present.
  const rejected = Boolean(alloc && alloc.status === "RESERVED" && alloc.reviewNote && alloc.raffleUrl);

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar className="h-10 w-10 rounded-xl">
            {r.listing.team.logoUrl && <AvatarImage src={r.listing.team.logoUrl} alt="" className="rounded-xl" />}
            <AvatarFallback className="rounded-xl">{r.listing.team.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{r.listing.team.name}</p>
            <a
              href={collabEntryUrl(`/listings/${r.listing.slug}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate font-display text-base font-semibold text-white hover:text-scarlet-soft"
            >
              {r.listing.title}
            </a>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <ChainBadge chain={r.listing.chain} showLabel={false} />
              <span className="text-xs text-muted-foreground">
                Filed <LocalTime value={r.createdAt} mode="date" />
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
          <Badge variant={meta.badge}>{meta.label}</Badge>
          <p className="text-sm tabular-nums text-white">
            {r.spotsGranted !== null ? (
              <>
                <span className="font-semibold text-emerald-300">{formatNumber(r.spotsGranted)}</span>
                <span className="text-muted-foreground"> of {formatNumber(r.spotsRequested)} granted</span>
              </>
            ) : (
              <span className="text-muted-foreground">{formatNumber(r.spotsRequested)} requested</span>
            )}
          </p>
        </div>
      </div>

      {r.reviewerNote && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-ink-black/30 p-3 text-sm">
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-scarlet-soft" />
          <div>
            <p className="text-xs font-medium text-muted-foreground">{r.listing.team.name}</p>
            <p className="whitespace-pre-wrap text-foreground/90">{r.reviewerNote}</p>
            {r.requesterReply && (
              <p className="mt-2 whitespace-pre-wrap border-l-2 border-primary/40 pl-3 text-muted-foreground">You: {r.requesterReply}</p>
            )}
          </div>
        </div>
      )}

      {r.status === "NEEDS_INFO" && (
        <div className="mt-4">
          <RequestReplyForm requestId={r.id} />
        </div>
      )}

      {alloc && alloc.status !== "REVOKED" && (
        <div className="mt-4 space-y-3 rounded-2xl border border-gold/25 bg-gold/[0.05] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gold">
              {formatNumber(alloc.spots)} spots · {ALLOCATION_STATUS_META[alloc.status].label}
            </p>
            <Badge variant={ALLOCATION_STATUS_META[alloc.status].badge}>{ALLOCATION_STATUS_META[alloc.status].label}</Badge>
          </div>
          <ol className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <Step done label="Granted" />
            <Step done={alloc.status === "CONFIRMED" || alloc.status === "DELIVERED"} label={`Winners submitted (${alloc.wallets.length}/${alloc.spots})`} />
            <Step done={alloc.status === "DELIVERED"} label="Accepted & whitelisted" />
          </ol>

          {/* The listing team's decision, when there is one. */}
          {rejected && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p className="text-xs font-semibold text-destructive">Changes requested by {r.listing.team.name}</p>
                <p className="whitespace-pre-wrap text-foreground/90">{alloc.reviewNote}</p>
                <p className="mt-1 text-xs text-muted-foreground">Update your winners or proof below and resubmit.</p>
              </div>
            </div>
          )}
          {alloc.status === "DELIVERED" && alloc.reviewNote && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <p className="whitespace-pre-wrap text-foreground/90">{alloc.reviewNote}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {alloc.status === "DELIVERED"
              ? `${r.listing.team.name} accepted your winners and added them.`
              : alloc.status === "CONFIRMED"
                ? `Submitted — waiting on ${r.listing.team.name} to review your winners and proof.`
                : `Run your giveaway, then submit up to ${alloc.spots} ${CHAIN_META[r.listing.chain].label} winner wallets plus the raffle link as proof.`}
            {r.listing.mintOrTgeAt && (
              <span className="ml-1 inline-flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                {r.listing.assetType === "TOKEN" ? "TGE" : "Mint"} <LocalTime value={r.listing.mintOrTgeAt} mode="date" />
              </span>
            )}
          </p>

          {alloc.status !== "DELIVERED" && (
            <AllocationWalletsForm
              allocationId={alloc.id}
              spots={alloc.spots}
              existing={walletsText}
              chainLabel={CHAIN_META[r.listing.chain].label}
              existingRaffleUrl={alloc.raffleUrl ?? ""}
              existingProofUrl={alloc.proofImageUrl}
            />
          )}
        </div>
      )}

      {alloc?.status === "REVOKED" && (
        <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          This allocation was revoked and the spots returned to the listing.
        </p>
      )}

      {(isOpen || declinable) && (
        <div className="mt-3 flex justify-end">
          <WithdrawRequestButton requestId={r.id} declining={declinable} />
        </div>
      )}

      {r.listing.team.discordInvite && alloc && alloc.status !== "REVOKED" && (
        <p className="mt-3 text-right text-xs">
          <Link href={r.listing.team.discordInvite} target="_blank" className="text-scarlet-soft hover:text-white">
            Contact {r.listing.team.name} on Discord →
          </Link>
        </p>
      )}
    </div>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={done ? "h-2 w-2 rounded-full bg-gold" : "h-2 w-2 rounded-full bg-muted-foreground/30"} />
      <span className={done ? "text-foreground/90" : undefined}>{label}</span>
    </li>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Gavel, Globe, Link2, MessageCircle, MessageSquare, Package, Wallet } from "lucide-react";

import { resolveTeamPage } from "@/server/queries/require-team-page";
import { getIncomingRequest } from "@/server/queries/collab";
import { ALLOCATION_STATUS_META, OPEN_REQUEST_STATUSES, REQUEST_STATUS_META } from "@/lib/collab/constants";
import { CHAIN_META } from "@/lib/constants";
import { formatNumber, shortenAddress } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { LocalTime } from "@/components/local-time";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EligibilityMeter } from "@/components/collab/eligibility-meter";
import { ReviewPanel } from "@/components/collab/review-panel";
import { AllocationRowActions } from "@/components/collab/allocation-row-actions";
import { roleAtLeast } from "@/lib/constants";

export const metadata = { title: "Review request" };

/** One partner request: pitch, numbers, evidence, eligibility, and the decision. */
export default async function ReviewRequestPage({ params }: { params: Promise<{ team: string; id: string }> }) {
  const { team: slug, id } = await params;
  const { team, membership } = await resolveTeamPage(slug);
  const r = await getIncomingRequest(team.id, id);
  if (!r) notFound();

  const meta = REQUEST_STATUS_META[r.status];
  const isOpen = OPEN_REQUEST_STATUSES.includes(r.status);
  const canDecide = isOpen && r.listing.status !== "CANCELLED";
  const stat = (n: number | null) => (n === null ? "—" : formatNumber(n));

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
        <Link href={`/dashboard/${slug}/collab/requests`}>
          <ArrowLeft className="h-4 w-4" />
          Back to requests
        </Link>
      </Button>

      <PageHeader title={r.requesterTeam.name} description={`Requesting ${formatNumber(r.spotsRequested)} spots on ${r.listing.title}`}>
        <Badge variant={meta.badge}>{meta.label}</Badge>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-4 p-5">
              <Avatar className="h-12 w-12 rounded-2xl">
                {r.requesterTeam.logoUrl && <AvatarImage src={r.requesterTeam.logoUrl} alt="" className="rounded-2xl" />}
                <AvatarFallback className="rounded-2xl">{r.requesterTeam.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-semibold text-white">{r.requesterTeam.name}</p>
                <p className="text-xs text-muted-foreground">
                  Filed <LocalTime value={r.createdAt} />
                  {r.submittedBy && <> by {r.submittedBy.name ?? r.submittedBy.email}</>}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {r.requesterTeam.xHandle && (
                  <Chip href={`https://x.com/${r.requesterTeam.xHandle}`} icon={Globe} label={`@${r.requesterTeam.xHandle}`} />
                )}
                {r.requesterTeam.discordInvite && <Chip href={r.requesterTeam.discordInvite} icon={MessageCircle} label="Discord" />}
                {r.requesterTeam.website && <Chip href={r.requesterTeam.website} icon={Globe} label="Website" />}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pitch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{r.pitch}</p>
              {r.audienceSummary && (
                <div className="rounded-xl border border-border bg-ink-black/30 p-4">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Audience</p>
                  <p className="whitespace-pre-wrap text-sm text-foreground/85">{r.audienceSummary}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Numbers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Mini label="Community" value={stat(r.communitySize)} />
                <Mini label="X followers" value={stat(r.twitterFollowers)} />
                <Mini label="Discord" value={stat(r.discordMembers)} />
                <Mini label="Holders" value={stat(r.holderCount)} />
              </div>
              <p className="text-xs text-muted-foreground">
                Self-reported.{" "}
                {r.requesterChains.length > 0 && <>Chains: {r.requesterChains.map((c) => CHAIN_META[c].label).join(", ")}. </>}
                {r.requesterAssetType && <>Type: {r.requesterAssetType}.</>}
              </p>
              {r.evidence.links.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Evidence</p>
                  {r.evidence.links.map((l) => (
                    <a
                      key={l}
                      href={l}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="flex items-center gap-2 truncate text-sm text-scarlet-soft hover:text-white"
                    >
                      <Link2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{l}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {(r.reviewerNote || r.requesterReply) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="h-4 w-4 text-scarlet-soft" />
                  Thread
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {r.reviewerNote && (
                  <Note who={`${team.name}${r.reviewedBy ? ` · ${r.reviewedBy.name ?? r.reviewedBy.email}` : ""}`} body={r.reviewerNote} />
                )}
                {r.requesterReply && <Note who={r.requesterTeam.name} body={r.requesterReply} accent />}
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="p-5">
              <EligibilityMeter result={{ eligible: r.eligible, score: r.eligibilityScore, checks: r.checks }} />
            </CardContent>
          </Card>

          {canDecide ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gavel className="h-4 w-4 text-scarlet-soft" />
                  Decision
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReviewPanel requestId={r.id} spotsRequested={r.spotsRequested} available={r.listing.available} />
              </CardContent>
            </Card>
          ) : (
            r.allocation && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-4 w-4 text-scarlet-soft" />
                    Allocation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Spots</span>
                    <span className="font-semibold text-white">{formatNumber(r.allocation.spots)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={ALLOCATION_STATUS_META[r.allocation.status].badge}>
                      {ALLOCATION_STATUS_META[r.allocation.status].label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{ALLOCATION_STATUS_META[r.allocation.status].blurb}</p>
                  {r.allocationWallets.length > 0 && (
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border bg-ink-black/30 p-3">
                      {r.allocationWallets.map((w) => (
                        <p key={w.address} className="flex items-center gap-2 font-mono text-xs text-foreground/85" title={w.address}>
                          <Wallet className="h-3 w-3 shrink-0 text-muted-foreground" />
                          {shortenAddress(w.address, 6)}
                          {w.label && <span className="truncate font-sans text-muted-foreground">{w.label}</span>}
                        </p>
                      ))}
                    </div>
                  )}
                  <AllocationRowActions
                    allocationId={r.allocation.id}
                    status={r.allocation.status}
                    canRevoke={roleAtLeast(membership.role, "ADMIN")}
                  />
                </CardContent>
              </Card>
            )
          )}

          {r.walletForDelivery && (
            <Card>
              <CardContent className="space-y-1 p-5 text-sm">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contact wallet</p>
                <p className="break-all font-mono text-xs text-white">{r.walletForDelivery}</p>
                {r.deliveryChain && <p className="text-xs text-muted-foreground">{CHAIN_META[r.deliveryChain].label}</p>}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function Note({ who, body, accent = false }: { who: string; body: string; accent?: boolean }) {
  return (
    <div className={accent ? "rounded-xl border border-primary/25 bg-primary/5 p-4" : "rounded-xl border border-border bg-ink-black/30 p-4"}>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{who}</p>
      <p className="whitespace-pre-wrap text-sm text-foreground/90">{body}</p>
    </div>
  );
}

function Chip({ href, icon: Icon, label }: { href: string; icon: typeof Globe; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-3 py-1.5 text-xs font-medium text-foreground/90 transition-colors hover:border-primary/50 hover:text-white"
    >
      <Icon className="h-3.5 w-3.5 text-scarlet-soft" />
      {label}
    </a>
  );
}

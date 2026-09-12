import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Globe,
  Handshake,
  Layers,
  ListChecks,
  Lock,
  LogIn,
  MessageCircle,
  Ticket,
  Users,
} from "lucide-react";

import { getCurrentUserId } from "@/lib/session";
import { brandCollab } from "@/lib/brand-collab";
import { absoluteUrl, formatNumber, shortenAddress } from "@/lib/utils";
import { joinCollabPath } from "@/lib/collab/host";
import { collabShareUrl, collabSignInHref, getCollabSurface, mainSiteHref } from "@/lib/collab/surface";
import { LISTING_PHASE_META, METHOD_META, REQUEST_STATUS_META, listingPhase } from "@/lib/collab/constants";
import { criteriaRows } from "@/lib/collab/format";
import { getPublicListing, type PublicListingDetail } from "@/server/queries/collab-public";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChainBadge } from "@/components/giveaway/chain-badge";
import { Countdown } from "@/components/giveaway/countdown";
import { LocalTime } from "@/components/local-time";
import { AssetTypeChip, MethodChip } from "@/components/collab/collab-chips";
import { InventoryBar } from "@/components/collab/inventory-bar";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getPublicListing(slug, null);
  if (!listing) return { title: "Listing not found" };
  const title = `${listing.title} · ${listing.team.name}`;
  const description =
    listing.description?.slice(0, 180) ??
    `${formatNumber(listing.available)} whitelist spots open to partners on ${brandCollab.name}.`;
  const image = listing.bannerUrl ? absoluteUrl(listing.bannerUrl) : absoluteUrl("/og-default.jpg");
  return {
    title,
    description,
    openGraph: { title, description, url: collabShareUrl(`/listings/${slug}`), siteName: brandCollab.name, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** Public listing page — inventory, criteria, request CTA, public raffle CTA. */
export default async function PublicListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [viewerId, surface] = await Promise.all([getCurrentUserId(), getCollabSurface()]);
  const listing = await getPublicListing(slug, viewerId);
  if (!listing) notFound();

  const phase = listingPhase(listing);
  const phaseMeta = LISTING_PHASE_META[phase];
  const href = (p: string) => joinCollabPath(surface.base, p);
  const rows = criteriaRows(listing.criteria);
  const raffle = listing.publicRaffle;
  const raffleLive = raffle?.status === "ACTIVE" && raffle.endAt.getTime() > Date.now();

  return (
    <main className="pb-20">
      <div className="relative h-72 w-full overflow-hidden bg-ink-charcoal sm:h-[24rem]">
        {listing.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.bannerUrl} alt="" className="h-full w-full scale-105 object-cover blur-[2px]" />
        ) : (
          <div className="h-full w-full bg-crimson-gradient/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />
        <div className="pointer-events-none absolute inset-0 bg-hero-radial opacity-60" />
      </div>

      <div className="container relative -mt-40">
        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          <div className="min-w-0">
            <Link
              href={href(`/projects/${listing.team.slug}`)}
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 py-1 pl-1 pr-3 backdrop-blur transition-colors hover:border-primary/40"
            >
              <Avatar className="h-7 w-7">
                {listing.team.logoUrl && <AvatarImage src={listing.team.logoUrl} alt="" />}
                <AvatarFallback>{listing.team.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-white">{listing.team.name}</span>
            </Link>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge variant={phaseMeta.badge}>
                {phase === "open" && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-scarlet opacity-70" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-scarlet" />
                  </span>
                )}
                {phaseMeta.label}
              </Badge>
              <MethodChip method={listing.distributionMethod} />
              <AssetTypeChip assetType={listing.assetType} />
              <ChainBadge chain={listing.chain} />
              {listing.visibility === "PRIVATE" && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" /> Private listing
                </span>
              )}
            </div>

            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{listing.title}</h1>

            <div className="mt-5 rounded-2xl border border-gold/25 bg-gold/[0.06] p-5">
              <div className="flex items-start gap-3">
                <Layers className="mt-0.5 h-6 w-6 shrink-0 text-gold" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-gold/80">Partner spots</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {formatNumber(listing.available)}{" "}
                    <span className="font-normal text-muted-foreground">of {formatNumber(listing.totalSpots)} available</span>
                  </p>
                  <InventoryBar listing={listing} className="mt-3" />
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetaStat icon={Handshake} label="Per partner" value={`${listing.spotsPerRequestMin}–${listing.spotsPerRequestMax}`} />
              <MetaStat
                icon={listing.requestCount === null ? Lock : Users}
                label="Requests"
                value={listing.requestCount === null ? "Hidden" : formatNumber(listing.requestCount)}
              />
              <MetaStat
                icon={CalendarClock}
                label={phase === "upcoming" ? "Opens" : "Closes"}
                value={<LocalTime value={phase === "upcoming" ? listing.startAt : listing.endAt} />}
              />
              <MetaStat
                icon={Globe}
                label={listing.assetType === "TOKEN" ? "TGE" : "Mint"}
                value={listing.mintOrTgeAt ? <LocalTime value={listing.mintOrTgeAt} mode="date" /> : "TBA"}
              />
            </div>

            {(phase === "open" || phase === "upcoming" || phase === "allocated") && (
              <div className="mt-6 rounded-2xl border border-border bg-card/40 p-5">
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {phase === "upcoming" ? "Requests open in" : "Requests close in"}
                </p>
                <Countdown target={phase === "upcoming" ? listing.startAt : listing.endAt} />
              </div>
            )}

            {raffle && (
              <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-gold/30 bg-gold/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Ticket className="mt-0.5 h-6 w-6 shrink-0 text-gold" />
                  <div>
                    <p className="font-semibold text-gold">
                      {raffleLive ? "Public raffle open" : raffle.status === "FINALIZED" ? "Public raffle winners drawn" : "Public raffle"}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {formatNumber(listing.publicSpots)} spots go to the community. No project needed — complete the tasks to enter.
                    </p>
                  </div>
                </div>
                <Button asChild variant="gold" className="shrink-0">
                  <Link href={href(`/raffles/${raffle.slug}`)}>{raffleLive ? "Enter raffle" : "View raffle"}</Link>
                </Button>
              </div>
            )}

            {listing.description && (
              <div className="mt-6 rounded-2xl border border-border bg-card/40 p-6">
                <h2 className="mb-2 font-display text-lg font-semibold text-white">Details</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{listing.description}</p>
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-border bg-card/40 p-6">
              <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-white">
                <ListChecks className="h-5 w-5 text-scarlet-soft" />
                Who qualifies
              </h2>
              <p className="mb-4 text-sm text-muted-foreground">{METHOD_META[listing.distributionMethod].blurb}</p>
              {rows.length === 0 ? (
                <p className="text-sm text-foreground/85">Open to every project and community.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {rows.map((r) => (
                    <li key={r.label} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-ink-black/30 px-4 py-2.5 text-sm">
                      <span className="flex items-center gap-2 text-foreground/90">
                        <CheckCircle2 className="h-4 w-4 text-scarlet-soft" />
                        {r.label}
                      </span>
                      <span className="shrink-0 font-medium text-white">{r.value}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <ProjectFacts listing={listing} />
          </div>

          <aside className="lg:sticky lg:top-20 lg:self-start">
            <RequestPanel listing={listing} phase={phase} viewerId={viewerId} href={href} />
          </aside>
        </div>
      </div>
    </main>
  );
}

async function RequestPanel({
  listing,
  phase,
  viewerId,
  href,
}: {
  listing: PublicListingDetail;
  phase: ReturnType<typeof listingPhase>;
  viewerId: string | null;
  href: (p: string) => string;
}) {
  const requestHref = href(`/listings/${listing.slug}/request`);
  const accepting = phase === "open";
  const firstTeamSlug = listing.viewerRequests[0]?.teamSlug ?? listing.requesterTeams[0]?.slug;
  const [signInHref, newProjectHref, outgoingHref, manageHref] = await Promise.all([
    collabSignInHref(`/listings/${listing.slug}/request`),
    mainSiteHref("/dashboard/new"),
    firstTeamSlug ? mainSiteHref(`/dashboard/${firstTeamSlug}/collab/outgoing`) : Promise.resolve(null),
    mainSiteHref(`/dashboard/${listing.team.slug}/collab/listings/${listing.id}`),
  ]);
  const canRequestWith = listing.requesterTeams.filter((t) => !t.hasActiveRequest);

  return (
    <div className="rounded-2xl border border-border bg-card bg-card-glow p-6 shadow-card">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-crimson-gradient shadow-glow-red">
          <Handshake className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold text-white">Request an allocation</h3>
          <p className="text-xs text-muted-foreground">For projects, DAOs and communities.</p>
        </div>
      </div>

      {listing.viewerRequests.length > 0 && (
        <div className="mb-5 space-y-2">
          {listing.viewerRequests.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-ink-black/40 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{r.teamName}</p>
                <p className="text-xs text-muted-foreground">
                  {r.spotsGranted ? `${r.spotsGranted} of ${r.spotsRequested} granted` : `${r.spotsRequested} spots requested`}
                </p>
              </div>
              <Badge variant={REQUEST_STATUS_META[r.status].badge}>{REQUEST_STATUS_META[r.status].label}</Badge>
            </div>
          ))}
          {outgoingHref && (
            <Link href={outgoingHref} className="inline-flex text-xs font-medium text-scarlet-soft hover:text-white">
              Track it on your desk →
            </Link>
          )}
        </div>
      )}

      {listing.viewerIsOwner ? (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>This is your listing. Review requests and manage inventory from your desk.</p>
          <Button asChild className="w-full">
            <Link href={manageHref}>Open your desk</Link>
          </Button>
        </div>
      ) : !accepting ? (
        <p className="text-sm text-muted-foreground">
          {phase === "upcoming"
            ? "Requests open soon — check back when the countdown hits zero."
            : phase === "allocated"
              ? "Every partner spot is spoken for. Watch for a public raffle, or check back if spots free up."
              : phase === "paused"
                ? "The project has paused new requests for now."
                : listing.drawnAt
                  ? "The partner raffle has been drawn. Requests are closed."
                  : "Requests are closed for this listing."}
        </p>
      ) : !viewerId ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Sign in with the account that manages your project to request spots.</p>
          <Button asChild size="lg" className="w-full">
            <Link href={signInHref}>
              <LogIn className="h-4 w-4" />
              Sign in to request
            </Link>
          </Button>
        </div>
      ) : listing.requesterTeams.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Requests are filed on behalf of a project. Set one up — logo, socials, chains — then come back.
          </p>
          <Button asChild size="lg" className="w-full">
            <Link href={newProjectHref}>Create a project</Link>
          </Button>
        </div>
      ) : canRequestWith.length === 0 ? (
        <p className="text-sm text-muted-foreground">Each of your projects already has an active request here.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pitch your community, share your numbers, and see your eligibility score before you submit.
          </p>
          <Button asChild size="lg" className="w-full">
            <Link href={requestHref}>
              <Handshake className="h-4 w-4" />
              Request allocation
            </Link>
          </Button>
        </div>
      )}

      <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
        Applicants stay private — only {listing.team.name} sees who requested and why.
      </p>
    </div>
  );
}

function ProjectFacts({ listing }: { listing: PublicListingDetail }) {
  const t = listing.team;
  const address = listing.assetType === "TOKEN" ? listing.tokenAddress : listing.collectionAddress;
  const facts = [
    t.totalSupply && { label: "Supply", value: t.totalSupply },
    t.mintPrice && { label: "Mint price", value: t.mintPrice },
    address && { label: "Contract", value: <span className="font-mono">{shortenAddress(address, 6)}</span> },
  ].filter(Boolean) as { label: string; value: ReactNode }[];

  if (!facts.length && !t.xHandle && !t.discordInvite && !t.website) return null;
  return (
    <div className="mt-6 rounded-2xl border border-border bg-card/40 p-6">
      <h2 className="mb-4 font-display text-lg font-semibold text-white">About {t.name}</h2>
      {t.description && <p className="mb-4 text-sm text-foreground/85">{t.description}</p>}
      {facts.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {facts.map((f) => (
            <MetaStat key={f.label} icon={Globe} label={f.label} value={f.value} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {t.xHandle && <LinkChip href={`https://x.com/${t.xHandle}`} icon={Globe} label={`@${t.xHandle}`} />}
        {t.discordInvite && <LinkChip href={t.discordInvite} icon={MessageCircle} label="Discord" />}
        {t.website && <LinkChip href={t.website} icon={Globe} label="Website" />}
      </div>
    </div>
  );
}

function MetaStat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 px-4 py-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function LinkChip({ href, icon: Icon, label }: { href: string; icon: typeof Globe; label: string }) {
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

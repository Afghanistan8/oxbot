import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  Trophy,
  Users,
  Lock,
  Globe,
  MessageCircle,
  Send,
  CalendarClock,
} from "lucide-react";

import { getCurrentUserId } from "@/lib/session";
import { getPublicGiveaway, getPublicWinners } from "@/server/queries/public-giveaway";
import { userHasProfileWallet } from "@/server/queries/profile";
import { getConnectedAccounts } from "@/lib/giveaway/entry-validation";
import { giveawayPhase, PHASE_META } from "@/lib/format";
import { GIVEAWAY_TYPE_META, GIVEAWAY_VISIBILITY_META } from "@/lib/constants";
import { formatNumber, absoluteUrl } from "@/lib/utils";
import { brand } from "@/lib/brand";
import { integrations } from "@/lib/env";

import { SiteHeader } from "@/components/brand/site-header";
import { SiteFooter } from "@/components/brand/site-footer";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChainBadge } from "@/components/giveaway/chain-badge";
import { Countdown } from "@/components/giveaway/countdown";
import { EntryWizard } from "@/components/entry/entry-wizard";
import { WinnersList } from "@/components/entry/winners-list";
import { LocalTime } from "@/components/local-time";

// Viewer-specific (entry progress, connected accounts) — always render live.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const giveaway = await getPublicGiveaway(slug, null);
  if (!giveaway) return { title: "Giveaway not found" };

  const title = `${giveaway.title} · ${giveaway.team.name}`;
  const description = giveaway.description ?? `${giveaway.prize} — enter on ${brand.name}.`;
  const url = absoluteUrl(`/giveaways/${slug}`);

  // Always resolve to an absolute URL, and always have *some* image — link
  // unfurlers (Discord, WhatsApp, X) won't render a preview card at all
  // without one, and most giveaways won't have set a custom banner.
  const image = giveaway.bannerUrl
    ? { url: absoluteUrl(giveaway.bannerUrl), alt: giveaway.title }
    : {
        url: absoluteUrl("/og-default.jpg"),
        width: 1200,
        height: 630,
        alt: `${giveaway.title} on ${brand.name}`,
      };

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: brand.name,
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}

export default async function PublicGiveawayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const viewerId = await getCurrentUserId();

  const giveaway = await getPublicGiveaway(slug, viewerId);
  if (!giveaway) notFound();

  const phase = giveawayPhase(giveaway);
  const phaseMeta = PHASE_META[phase];
  const typeMeta = GIVEAWAY_TYPE_META[giveaway.type];

  // Winners are public once drawn.
  const winners =
    phase === "finalized" || giveaway.drawnAt ? await getPublicWinners(giveaway.id) : [];

  // Connection flags drive the wizard's "Connect X / Discord" prompts (live mode
  // only). Loaded solely for the current viewer — never any other entrant.
  let hasAccountEmail = false;
  let twitterConnected = false;
  let discordConnected = false;
  let hasProfileWallet = false;
  if (viewerId) {
    const [accounts, walletSaved] = await Promise.all([
      getConnectedAccounts(viewerId),
      userHasProfileWallet(viewerId),
    ]);
    hasAccountEmail = Boolean(accounts.email);
    twitterConnected = Boolean(accounts.twitterUserId);
    discordConnected = Boolean(accounts.discordUserId);
    hasProfileWallet = walletSaved;
  }

  return (
    <>
      <SiteHeader />

      <main className="pb-20">
        {/* Banner — full-bleed background behind the hero, not a cropped strip */}
        <div className="relative h-72 w-full overflow-hidden bg-ink-charcoal sm:h-[26rem]">
          {giveaway.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={giveaway.bannerUrl}
              alt=""
              className="h-full w-full scale-105 object-cover blur-[2px]"
            />
          ) : (
            <div className="h-full w-full bg-crimson-gradient/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />
          <div className="pointer-events-none absolute inset-0 bg-hero-radial opacity-60" />
        </div>

        <div className="container -mt-40 relative">
          <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
            {/* --- Main column --- */}
            <div className="min-w-0">
              {/* Team + badges */}
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 py-1 pl-1 pr-3 backdrop-blur">
                  <Avatar className="h-7 w-7">
                    {giveaway.team.logoUrl && (
                      <AvatarImage src={giveaway.team.logoUrl} alt="" />
                    )}
                    <AvatarFallback>{teamInitials(giveaway.team.name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-white">{giveaway.team.name}</span>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge variant={phaseMeta.badge}>
                  {phase === "live" && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-scarlet opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-scarlet" />
                    </span>
                  )}
                  {phaseMeta.label}
                </Badge>
                <span className="text-sm text-scarlet-soft/90">{typeMeta.label}</span>
                <ChainBadge chain={giveaway.chain} />
                {giveaway.visibility !== "PUBLIC" && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    {GIVEAWAY_VISIBILITY_META[giveaway.visibility].label}
                  </span>
                )}
              </div>

              <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {giveaway.title}
              </h1>

              {/* Prize highlight */}
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-gold/25 bg-gold/[0.06] p-5">
                <Trophy className="mt-0.5 h-6 w-6 shrink-0 text-gold" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gold/80">
                    Prize
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-lg font-semibold text-white">
                    {giveaway.prize}
                  </p>
                </div>
              </div>

              {/* Meta stats */}
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MetaStat
                  icon={Trophy}
                  label={giveaway.type === "FCFS" ? "Slots" : "Winners"}
                  value={formatNumber(giveaway.winnersCount)}
                />
                <MetaStat
                  icon={giveaway.entryCount === null ? Lock : Users}
                  label="Entries"
                  value={giveaway.entryCount === null ? "Hidden" : formatNumber(giveaway.entryCount)}
                />
                <MetaStat
                  icon={CalendarClock}
                  label={phase === "upcoming" ? "Starts" : "Ends"}
                  value={<LocalTime value={phase === "upcoming" ? giveaway.startAt : giveaway.endAt} />}
                />
              </div>

              {/* Countdown */}
              {(phase === "live" || phase === "upcoming") && (
                <div className="mt-6 rounded-2xl border border-border bg-card/40 p-5">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {phase === "upcoming" ? "Entry opens in" : "Entry closes in"}
                  </p>
                  <Countdown target={phase === "upcoming" ? giveaway.startAt : giveaway.endAt} />
                </div>
              )}

              {/* Winners (once drawn) */}
              {winners.length > 0 && (
                <div className="mt-6">
                  <WinnersList winners={winners} />
                </div>
              )}

              {/* Description */}
              {giveaway.description && (
                <div className="mt-6 rounded-2xl border border-border bg-card/40 p-6">
                  <h2 className="mb-2 font-display text-lg font-semibold text-white">
                    Details
                  </h2>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
                    {giveaway.description}
                  </p>
                </div>
              )}

              {/* Project links */}
              <ProjectLinks giveaway={giveaway} />

            </div>

            {/* --- Entry sidebar --- */}
            <aside className="lg:sticky lg:top-20 lg:self-start">
              <EntryWizard
                giveawayId={giveaway.id}
                slug={giveaway.slug}
                type={giveaway.type}
                phase={phase}
                isSignedIn={Boolean(viewerId)}
                hasAccountEmail={hasAccountEmail}
                hasProfileWallet={hasProfileWallet}
                twitterConnected={twitterConnected}
                discordConnected={discordConnected}
                twitterOauthLive={integrations.twitter.oauthLive}
                discordOauthLive={integrations.discord.oauthLive}
                requirements={giveaway.requirements}
                viewerEntry={giveaway.viewerEntry}
                xAccount={giveaway.xAccount}
                discordInvite={giveaway.team.discordInvite}
              />
            </aside>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function MetaStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: ReactNode;
}) {
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

function ProjectLinks({
  giveaway,
}: {
  giveaway: Awaited<ReturnType<typeof getPublicGiveaway>>;
}) {
  if (!giveaway) return null;
  const { team, xAccount, discordServerId, telegram } = giveaway;
  const xHandle = xAccount ?? team.xHandle;
  const hasAny = xHandle || team.discordInvite || discordServerId || telegram || team.website;
  if (!hasAny) return null;

  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {xHandle && (
        <LinkChip href={`https://x.com/${xHandle.replace(/^@/, "")}`} icon={Globe} label={`@${xHandle.replace(/^@/, "")}`} />
      )}
      {team.discordInvite && (
        <LinkChip href={team.discordInvite} icon={MessageCircle} label="Discord" />
      )}
      {telegram && (
        <LinkChip
          href={telegram.startsWith("http") ? telegram : `https://${telegram}`}
          icon={Send}
          label="Telegram"
        />
      )}
      {team.website && <LinkChip href={team.website} icon={Globe} label="Website" />}
    </div>
  );
}

function LinkChip({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Globe;
  label: string;
}) {
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

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

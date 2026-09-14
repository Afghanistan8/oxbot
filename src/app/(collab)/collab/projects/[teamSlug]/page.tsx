import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarClock, Coins, Globe, Layers, MessageCircle, Send, Ticket } from "lucide-react";

import { db } from "@/lib/db";
import { CHAIN_META } from "@/lib/constants";
import { joinCollabPath } from "@/lib/collab/host";
import { getCollabSurface, mainSiteHref } from "@/lib/collab/surface";
import { listPublicListings, type ListingCardData } from "@/server/queries/collab-public";
import { listPublicGiveaways } from "@/server/queries/giveaways";
import type { GiveawayCardData } from "@/types/giveaway";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChainBadge } from "@/components/giveaway/chain-badge";
import { GiveawayCard } from "@/components/giveaway/giveaway-card";
import { LocalTime } from "@/components/local-time";
import { ListingCard } from "@/components/collab/listing-card";

/** Public project fields only — never members, emails, webhooks or guild ids. */
async function getPublicProject(slug: string) {
  return db.team.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logoUrl: true,
      bannerUrl: true,
      website: true,
      xHandle: true,
      discordInvite: true,
      telegram: true,
      chains: true,
      primaryChain: true,
      totalSupply: true,
      mintPrice: true,
      mintAt: true,
      mintTba: true,
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ teamSlug: string }> }): Promise<Metadata> {
  const { teamSlug } = await params;
  const team = await getPublicProject(teamSlug);
  if (!team) return { title: "Project not found" };
  return { title: team.name, description: team.description?.slice(0, 180) ?? `${team.name} on the Collab desk.` };
}

/** Public project profile on the Collab desk: identity, listings, raffles. */
export default async function CollabProjectPage({ params }: { params: Promise<{ teamSlug: string }> }) {
  const { teamSlug } = await params;
  const [team, surface] = await Promise.all([getPublicProject(teamSlug), getCollabSurface()]);
  if (!team) notFound();
  const href = (p: string) => joinCollabPath(surface.base, p);

  const [listings, giveaways, oxbotHref] = await Promise.all([
    listPublicListings({ teamId: team.id, sort: "ending", take: 24 }).catch((): ListingCardData[] => []),
    listPublicGiveaways({ teamId: team.id, sort: "ending", take: 8 }).catch((): GiveawayCardData[] => []),
    mainSiteHref("/"),
  ]);

  return (
    <main className="pb-16">
      <div className="relative h-56 w-full overflow-hidden bg-ink-charcoal sm:h-72">
        {team.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-crimson-gradient/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-hero-radial opacity-50" />
      </div>

      <div className="container relative -mt-20">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
          <Avatar className="h-24 w-24 rounded-3xl border-4 border-background shadow-card">
            {team.logoUrl && <AvatarImage src={team.logoUrl} alt="" className="rounded-3xl object-cover" />}
            <AvatarFallback className="rounded-3xl text-2xl">{team.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{team.name}</h1>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {team.primaryChain && <ChainBadge chain={team.primaryChain} />}
              {team.chains
                .filter((c) => c !== team.primaryChain)
                .map((c) => (
                  <ChainBadge key={c} chain={c} showLabel={false} />
                ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {team.xHandle && <LinkChip href={`https://x.com/${team.xHandle}`} icon={Globe} label={`@${team.xHandle}`} />}
            {team.discordInvite && <LinkChip href={team.discordInvite} icon={MessageCircle} label="Discord" />}
            {team.telegram && (
              <LinkChip href={team.telegram.startsWith("http") ? team.telegram : `https://${team.telegram}`} icon={Send} label="Telegram" />
            )}
            {team.website && <LinkChip href={team.website} icon={Globe} label="Website" />}
          </div>
        </div>

        {team.description && <p className="mt-6 max-w-3xl whitespace-pre-wrap text-muted-foreground">{team.description}</p>}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact icon={Coins} label="Supply" value={team.totalSupply ?? "—"} />
          <Fact icon={Coins} label="Mint price" value={team.mintPrice ?? "—"} />
          <Fact
            icon={CalendarClock}
            label="Mint"
            value={team.mintTba ? "TBA" : team.mintAt ? <LocalTime value={team.mintAt} mode="date" /> : "—"}
          />
          <Fact icon={Layers} label="Chain" value={team.primaryChain ? CHAIN_META[team.primaryChain].label : "—"} />
        </div>

        <section className="mt-12">
          <h2 className="mb-5 flex items-center gap-2 font-display text-2xl font-bold text-white">
            <Layers className="h-5 w-5 text-scarlet-soft" />
            Whitelist listings
          </h2>
          {listings.length ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} href={href(`/listings/${l.slug}`)} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-border bg-card/30 px-6 py-10 text-center text-sm text-muted-foreground">
              No listings on the desk right now.
            </p>
          )}
        </section>

        {giveaways.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-5 flex items-center gap-2 font-display text-2xl font-bold text-white">
              <Ticket className="h-5 w-5 text-scarlet-soft" />
              Raffles &amp; giveaways
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {giveaways.map((g) => (
                <GiveawayCard key={g.id} giveaway={g} href={`${oxbotHref.replace(/\/$/, "")}/giveaways/${g.slug}`} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Coins; label: string; value: React.ReactNode }) {
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

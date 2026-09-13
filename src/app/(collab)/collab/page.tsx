import Link from "next/link";
import { ArrowRight, Handshake, Layers, Radio, ShieldCheck, Sparkles, Ticket } from "lucide-react";

import { brandCollab } from "@/lib/brand-collab";
import { auth } from "@/lib/auth";
import { formatNumber } from "@/lib/utils";
import { joinCollabPath } from "@/lib/collab/host";
import { getCollabSurface, mainSiteHref } from "@/lib/collab/surface";
import { getPrimaryTeamSlug } from "@/server/queries/teams";
import { listPublicGiveaways } from "@/server/queries/giveaways";
import {
  getCollabSignal,
  getFeaturedPartners,
  listPublicListings,
  type CollabSignal,
  type FeaturedPartner,
  type ListingCardData,
} from "@/server/queries/collab-public";
import type { GiveawayCardData } from "@/types/giveaway";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GiveawayCard } from "@/components/giveaway/giveaway-card";
import { CollabHowItWorks } from "@/components/collab/collab-how-it-works";
import { ListingCard } from "@/components/collab/listing-card";

/**
 * OxFoxes Collab landing — hero, live signal, listings, how it works, public
 * raffles, featured partners. Rendered at `/collab` (or `/` on the Collab host).
 */
export default async function CollabLandingPage() {
  const [session, surface] = await Promise.all([auth(), getCollabSurface()]);
  const userId = session?.user?.id;
  const primaryTeamSlug = userId ? await getPrimaryTeamSlug(userId) : null;
  const href = (p: string) => joinCollabPath(surface.base, p);

  const deskCta = !userId
    ? { href: await mainSiteHref(`/signin?callbackUrl=${encodeURIComponent("/dashboard")}`), label: "Open a desk" }
    : primaryTeamSlug
      ? { href: await mainSiteHref(`/dashboard/${primaryTeamSlug}/collab`), label: "Open your desk" }
      : { href: await mainSiteHref("/dashboard/new"), label: "Create a project" };

  // Render even without a database (fresh clone) — every section degrades to empty.
  let signal: CollabSignal = { openListings: 0, spotsRemaining: 0, liveRaffles: 0 };
  let listings: ListingCardData[] = [];
  let raffles: GiveawayCardData[] = [];
  let partners: FeaturedPartner[] = [];
  try {
    [signal, listings, raffles, partners] = await Promise.all([
      getCollabSignal(),
      listPublicListings({ sort: "ending", take: 6 }),
      listPublicGiveaways({ collabOnly: true, sort: "ending", take: 4 }),
      getFeaturedPartners(),
    ]);
  } catch {
    // DB unavailable.
  }

  return (
    <main>
      <Hero browseHref={href("/listings")} deskCta={deskCta} signal={signal} />

      <section className="container -mt-6 relative">
        <div className="grid grid-cols-1 gap-3 rounded-3xl border border-border bg-card/60 p-3 backdrop-blur sm:grid-cols-3">
          <Signal icon={Layers} label="Open listings" value={formatNumber(signal.openListings)} />
          <Signal icon={Handshake} label="Partner spots remaining" value={formatNumber(signal.spotsRemaining)} />
          <Signal icon={Ticket} label="Live public raffles" value={formatNumber(signal.liveRaffles)} live={signal.liveRaffles > 0} />
        </div>
      </section>

      <section id="listings" className="container scroll-mt-20 py-16">
        <SectionHead
          title="On the desk"
          body="Whitelist inventory from projects looking for aligned partners."
          link={{ href: href("/listings"), label: "All listings" }}
        />
        {listings.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} href={href(`/listings/${l.slug}`)} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card/30 px-6 py-14 text-center">
            <p className="font-display text-lg font-semibold text-white">The desk opens soon</p>
            <p className="mt-1 text-sm text-muted-foreground">First listings are being prepared. {deskCta.label} to list yours.</p>
          </div>
        )}
      </section>

      <div className="container">
        <div className="divider-glow" />
      </div>

      <CollabHowItWorks guideHref={href("/guide")} />

      {raffles.length > 0 && (
        <section className="container py-16">
          <SectionHead
            title="Public whitelist raffles"
            body="Spots projects opened to everyone. Complete the tasks, enter, get drawn."
            link={{ href: href("/raffles"), label: "All raffles" }}
          />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {raffles.map((g) => (
              <GiveawayCard key={g.id} giveaway={g} href={href(`/raffles/${g.slug}`)} />
            ))}
          </div>
        </section>
      )}

      {partners.length > 0 && (
        <section className="container py-12">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-gold/80">Listing on the desk</p>
          <div className="mx-auto mt-6 flex max-w-4xl flex-wrap justify-center gap-3">
            {partners.map((p) => (
              <Link
                key={p.slug}
                href={href(`/projects/${p.slug}`)}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 py-1.5 pl-1.5 pr-4 transition-colors hover:border-primary/40"
              >
                <Avatar className="h-7 w-7">
                  {p.logoUrl && <AvatarImage src={p.logoUrl} alt="" />}
                  <AvatarFallback className="text-[10px]">{p.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-white">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.openListings}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="container py-16">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-crimson-gradient p-10 shadow-glow-red-lg sm:p-14">
          <div className="pointer-events-none absolute inset-0 bg-crimson-sheen" />
          <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                List once. Distribute cleanly.
              </h2>
              <p className="mt-3 text-white/80">
                Inventory that can&apos;t be oversold, criteria that score every pitch, and a wallet export when it&apos;s done.
              </p>
            </div>
            <Button asChild size="lg" variant="gold" className="shrink-0">
              <Link href={deskCta.href}>
                {deskCta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function Hero({
  browseHref,
  deskCta,
  signal,
}: {
  browseHref: string;
  deskCta: { href: string; label: string };
  signal: CollabSignal;
}) {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid-red mask-fade-bottom opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-hero-radial" />

      <div className="container relative grid gap-16 py-24 sm:py-28 lg:grid-cols-2 lg:items-center lg:py-32">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-scarlet-soft">
            Whitelists <span className="text-muted-foreground/50">·</span> Partnerships{" "}
            <span className="text-muted-foreground/50">·</span> Raffles
          </p>
          <h1 className="mt-5 font-display text-5xl font-black leading-[1.03] tracking-tight text-white sm:text-6xl md:text-7xl">
            Whitelist partnerships.{" "}
            <span className="text-gradient-crimson">Without the Telegram chaos.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Projects allocate spots. DAOs and communities request them. Public raffles fill the rest.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={browseHref}>
                Browse listings
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={deskCta.href}>{deskCta.label}</Link>
            </Button>
          </div>

          <div className="mt-14 grid max-w-lg grid-cols-1 gap-4 sm:grid-cols-3">
            <TrustPoint icon={Layers} title="Atomic inventory" body="Never oversold." />
            <TrustPoint icon={ShieldCheck} title="Private desk" body="Applicants stay yours." />
            <TrustPoint icon={Ticket} title="Public raffles" body="Seeded, auditable." />
          </div>
        </div>

        <div className="relative hidden aspect-square items-center justify-center lg:flex">
          <div className="pointer-events-none absolute h-[26rem] w-[26rem] rounded-full bg-primary/20 blur-[100px]" />
          <div className="pointer-events-none absolute right-8 top-6 h-56 w-56 rounded-full bg-scarlet/25 blur-[80px]" />
          <div className="relative h-80 w-80">
            <div className="absolute inset-0 rounded-[2.5rem] border border-primary/25 shadow-glow-red" />
            <div className="absolute inset-6 rounded-[2rem] border border-primary/15" />
            <div className="glass-red absolute inset-12 rounded-3xl shadow-card" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="grid h-24 w-24 place-items-center rounded-3xl bg-crimson-gradient shadow-glow-red-lg">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
            </div>
          </div>
          <div className="glass-red absolute -bottom-4 right-0 w-64 rounded-2xl p-4 shadow-card">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live signal
            </p>
            <p className="mt-2 text-sm text-foreground/90">
              {signal.openListings > 0
                ? `${formatNumber(signal.spotsRemaining)} partner spots open across ${signal.openListings} listing${signal.openListings === 1 ? "" : "s"}`
                : brandCollab.tagline}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Signal({ icon: Icon, label, value, live = false }: { icon: typeof Layers; label: string; value: string; live?: boolean }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-ink-black/40 px-5 py-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10">
        {live ? <Radio className="h-5 w-5 text-scarlet-soft" /> : <Icon className="h-5 w-5 text-scarlet-soft" />}
      </div>
      <div>
        <p className="font-display text-2xl font-bold tabular-nums text-white">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function SectionHead({ title, body, link }: { title: string; body: string; link: { href: string; label: string } }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
      <Link href={link.href} className="hidden shrink-0 items-center gap-1 text-sm text-scarlet-soft hover:text-white sm:inline-flex">
        {link.label} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function TrustPoint({ icon: Icon, title, body }: { icon: typeof Layers; title: string; body: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 text-left backdrop-blur">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10">
        <Icon className="h-5 w-5 text-scarlet-soft" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

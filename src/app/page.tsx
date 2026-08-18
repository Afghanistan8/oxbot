import Link from "next/link";
import { ArrowRight, Sparkles, Lock, ShieldCheck, Gift } from "lucide-react";

import { brand } from "@/lib/brand";
import { ALL_CHAINS } from "@/lib/constants";
import type { Blockchain } from "@prisma/client";
import { auth } from "@/lib/auth";
import { getPrimaryTeamSlug } from "@/server/queries/teams";
import {
  listPublicGiveaways,
  activePublicChains,
  countLivePublicGiveaways,
} from "@/server/queries/giveaways";
import { getPlatformFounders, type PlatformFounder } from "@/server/queries/founders";
import type { GiveawayCardData } from "@/types/giveaway";

import { SiteHeader } from "@/components/brand/site-header";
import { SiteFooter } from "@/components/brand/site-footer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GiveawayCard } from "@/components/giveaway/giveaway-card";
import { GiveawayFilters } from "@/components/giveaway/giveaway-filters";
import { HowItWorks } from "@/components/marketing/how-it-works";

// Always render at request time — reads live giveaway data + URL filters.
export const dynamic = "force-dynamic";

function parseChain(value?: string): Blockchain | undefined {
  if (!value) return undefined;
  const upper = value.toUpperCase() as Blockchain;
  return ALL_CHAINS.includes(upper) ? upper : undefined;
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const chain = parseChain(
    typeof params.chain === "string" ? params.chain : undefined
  );
  const sort = params.sort === "new" ? "new" : "ending";
  const liveOnly = params.live === "1";

  const session = await auth();
  const userId = session?.user?.id;
  const primaryTeamSlug = userId ? await getPrimaryTeamSlug(userId) : null;
  // Signed-out visitors and signed-in-without-a-project visitors never see a
  // "launch a giveaway" CTA — only someone who already owns a project does.
  const launchCta: { href: string; label: string } = !userId
    ? { href: "/signin", label: "Sign in" }
    : primaryTeamSlug
      ? { href: `/dashboard/${primaryTeamSlug}/giveaways/new`, label: "Create giveaway" }
      : { href: "/dashboard", label: "Go to dashboard" };

  // The landing page must render even before a DATABASE_URL is configured, so
  // every query degrades gracefully to an empty/zero state.
  let giveaways: GiveawayCardData[] = [];
  let chains: Blockchain[] = [];
  let liveCount = 0;
  let founders: PlatformFounder[] = [];
  try {
    [giveaways, chains, liveCount, founders] = await Promise.all([
      listPublicGiveaways({ chain, sort, liveOnly }),
      activePublicChains(),
      countLivePublicGiveaways(),
      getPlatformFounders(),
    ]);
  } catch {
    // DB unavailable (e.g. no DATABASE_URL yet) — show the empty state.
  }

  return (
    <>
      <SiteHeader />

      <main>
        <Hero liveCount={liveCount} totalShown={giveaways.length} launchCta={launchCta} />

        {/* Explore / public grid */}
        <section id="explore" className="container scroll-mt-20 py-16">
          <div className="mb-8 flex flex-col gap-2">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Explore giveaways
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Live drops from crypto &amp; NFT teams. Enter before the timer
                  hits zero.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <GiveawayFilters
              chains={chains.length ? chains : ALL_CHAINS}
              activeChain={chain}
              sort={sort}
              liveOnly={liveOnly}
            />
          </div>

          {giveaways.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {giveaways.map((g) => (
                <GiveawayCard key={g.id} giveaway={g} />
              ))}
            </div>
          ) : (
            <EmptyState hasFilters={Boolean(chain) || liveOnly} launchCta={launchCta} />
          )}
        </section>

        <div className="container">
          <div className="divider-glow" />
        </div>

        <HowItWorks />

        <FoundersSection founders={founders} />

        <CtaBand launchCta={launchCta} />
      </main>

      <SiteFooter />
    </>
  );
}

function Hero({
  liveCount,
  totalShown,
  launchCta,
}: {
  liveCount: number;
  totalShown: number;
  launchCta: { href: string; label: string };
}) {
  return (
    <section className="relative overflow-hidden">
      {/* Layered backdrop: grid + radial crimson bloom */}
      <div className="pointer-events-none absolute inset-0 bg-grid-red mask-fade-bottom opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-hero-radial" />

      <div className="container relative grid gap-16 py-24 sm:py-28 lg:grid-cols-2 lg:items-center lg:py-36">
        {/* --- Left: copy --- */}
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-scarlet-soft">
            Raffles <span className="text-muted-foreground/50">·</span> Giveaways{" "}
            <span className="text-muted-foreground/50">·</span> Web3
          </p>

          <h1 className="mt-5 font-display text-5xl font-black leading-[1.03] tracking-tight text-white sm:text-6xl md:text-7xl">
            Run giveaways with a{" "}
            <span className="text-gradient-crimson">fierce, elegant</span> edge
          </h1>

          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            {brand.description}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={launchCta.href}>
                {launchCta.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#explore">Explore live drops</Link>
            </Button>
          </div>

          {/* Trust points */}
          <div className="mt-14 grid max-w-lg grid-cols-1 gap-4 sm:grid-cols-3">
            <TrustPoint icon={Lock} title="Private entries" body="Only you see who entered." />
            <TrustPoint icon={ShieldCheck} title="Provably fair" body="Seeded CSPRNG draws." />
            <TrustPoint icon={Gift} title="Three modes" body="Raffle · FCFS · Codes." />
          </div>

          {totalShown > 0 && (
            <p className="mt-10 text-xs uppercase tracking-widest text-muted-foreground/70">
              Scroll to explore {totalShown} open giveaway
              {totalShown === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {/* --- Right: abstract crimson visual (no illustration/mascot) --- */}
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

          {/* Floating live-status card */}
          <div className="glass-red absolute -bottom-4 right-0 w-64 rounded-2xl p-4 shadow-card">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live signal
            </p>
            <p className="mt-2 text-sm text-foreground/90">
              {liveCount > 0
                ? `${liveCount} giveaway${liveCount === 1 ? "" : "s"} live right now`
                : "Provably-fair Web3 giveaways, launching soon."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustPoint({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Lock;
  title: string;
  body: string;
}) {
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

function EmptyState({
  hasFilters,
  launchCta,
}: {
  hasFilters: boolean;
  launchCta: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/30 px-6 py-20 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-crimson-gradient shadow-glow-red">
        <Gift className="h-7 w-7 text-white" />
      </div>
      <h3 className="mt-5 font-display text-xl font-semibold text-white">
        {hasFilters ? "No giveaways match those filters" : "No live giveaways yet"}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {hasFilters
          ? "Try clearing a filter, or check back soon for new drops."
          : "Be the first to launch one. Your community is waiting."}
      </p>
      <Button asChild className="mt-6">
        <Link href={launchCta.href}>
          {launchCta.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function FoundersSection({ founders }: { founders: PlatformFounder[] }) {
  if (!founders || founders.length === 0) return null;

  return (
    <section className="container py-16">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-gold/80">
          Team members
        </p>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          The team behind <span className="text-gradient-crimson">{brand.name}</span>
        </h2>
      </div>

      <div className="mx-auto mt-12 flex flex-wrap justify-center gap-6">
        {founders.map((f, i) => (
          <div
            key={`${f.handle ?? f.name ?? "founder"}-${i}`}
            className="w-full max-w-sm rounded-3xl border border-border bg-card/40 p-8"
          >
            <Avatar className="h-24 w-24 rounded-2xl">
              {f.image && <AvatarImage src={f.image} alt="" className="rounded-2xl object-cover" />}
              <AvatarFallback className="rounded-2xl text-xl">
                {founderInitials(f.name ?? f.handle ?? "?")}
              </AvatarFallback>
            </Avatar>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-gold/80">
              {f.role}
            </p>
            {f.name && (
              <p className="mt-1 font-display text-2xl font-bold text-white">{f.name}</p>
            )}
            {f.handle && (
              <a
                href={`https://x.com/${f.handle.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm text-muted-foreground transition-colors hover:text-scarlet-soft"
              >
                @{f.handle.replace(/^@/, "")}
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function founderInitials(value: string): string {
  const parts = value.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function CtaBand({ launchCta }: { launchCta: { href: string; label: string } }) {
  return (
    <section className="container py-20">
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-crimson-gradient p-10 shadow-glow-red-lg sm:p-14">
        <div className="pointer-events-none absolute inset-0 bg-crimson-sheen" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-scarlet/20 blur-3xl" />
        <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to run your best drop yet?
            </h2>
            <p className="mt-3 text-white/80">
              Spin up a private, provably-fair giveaway in minutes. No entrant
              data leaks. No hidden math.
            </p>
          </div>
          <Button asChild size="lg" variant="gold" className="shrink-0">
            <Link href={launchCta.href}>
              {launchCta.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

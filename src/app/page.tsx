import Link from "next/link";
import { ArrowRight, Sparkles, Lock, ShieldCheck, Gift } from "lucide-react";

import { brand } from "@/lib/brand";
import { ALL_CHAINS } from "@/lib/constants";
import type { Blockchain } from "@prisma/client";
import {
  listPublicGiveaways,
  activePublicChains,
  countLivePublicGiveaways,
} from "@/server/queries/giveaways";
import type { GiveawayCardData } from "@/types/giveaway";

import { SiteHeader } from "@/components/brand/site-header";
import { SiteFooter } from "@/components/brand/site-footer";
import { Button } from "@/components/ui/button";
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

  // The landing page must render even before a DATABASE_URL is configured, so
  // every query degrades gracefully to an empty/zero state.
  let giveaways: GiveawayCardData[] = [];
  let chains: Blockchain[] = [];
  let liveCount = 0;
  try {
    [giveaways, chains, liveCount] = await Promise.all([
      listPublicGiveaways({ chain, sort, liveOnly }),
      activePublicChains(),
      countLivePublicGiveaways(),
    ]);
  } catch {
    // DB unavailable (e.g. no DATABASE_URL yet) — show the empty state.
  }

  return (
    <>
      <SiteHeader />

      <main>
        <Hero liveCount={liveCount} totalShown={giveaways.length} />

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
            <EmptyState hasFilters={Boolean(chain) || liveOnly} />
          )}
        </section>

        <div className="container">
          <div className="divider-glow" />
        </div>

        <HowItWorks />

        <CtaBand />
      </main>

      <SiteFooter />
    </>
  );
}

function Hero({
  liveCount,
  totalShown,
}: {
  liveCount: number;
  totalShown: number;
}) {
  return (
    <section className="relative overflow-hidden">
      {/* Layered backdrop: grid + radial crimson bloom */}
      <div className="pointer-events-none absolute inset-0 bg-grid-red mask-fade-bottom opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-hero-radial" />

      <div className="container relative flex flex-col items-center py-24 text-center sm:py-32">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-scarlet-soft shadow-glow-red">
          <Sparkles className="h-3.5 w-3.5" />
          {liveCount > 0
            ? `${liveCount} giveaway${liveCount === 1 ? "" : "s"} live right now`
            : "Provably-fair Web3 giveaways"}
        </div>

        <h1 className="mt-6 max-w-4xl font-display text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl">
          Run giveaways with a{" "}
          <span className="text-gradient-crimson">fierce, elegant</span> edge
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          {brand.description}
        </p>

        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/signin?callbackUrl=/dashboard">
              Launch a giveaway
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="#explore">Explore live drops</Link>
          </Button>
        </div>

        {/* Trust points */}
        <div className="mt-14 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          <TrustPoint
            icon={Lock}
            title="Private entries"
            body="Only you see who entered."
          />
          <TrustPoint
            icon={ShieldCheck}
            title="Provably fair"
            body="Seeded CSPRNG draws."
          />
          <TrustPoint
            icon={Gift}
            title="Three modes"
            body="Raffle · FCFS · Codes."
          />
        </div>

        {totalShown > 0 && (
          <p className="mt-10 text-xs uppercase tracking-widest text-muted-foreground/70">
            Scroll to explore {totalShown} open giveaway
            {totalShown === 1 ? "" : "s"}
          </p>
        )}
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

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
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
        <Link href="/signin?callbackUrl=/dashboard">
          Launch a giveaway
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function CtaBand() {
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
            <Link href="/signin?callbackUrl=/dashboard">
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

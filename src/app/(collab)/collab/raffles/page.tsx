import type { Metadata } from "next";
import { Ticket } from "lucide-react";

import { ALL_CHAINS } from "@/lib/constants";
import { joinCollabPath } from "@/lib/collab/host";
import { getCollabSurface } from "@/lib/collab/surface";
import type { SearchParams } from "@/lib/collab/params";
import { listPublicGiveaways } from "@/server/queries/giveaways";
import type { GiveawayCardData } from "@/types/giveaway";
import type { Blockchain } from "@prisma/client";
import { GiveawayCard } from "@/components/giveaway/giveaway-card";
import { GiveawayFilters } from "@/components/giveaway/giveaway-filters";

export const metadata: Metadata = {
  title: "Public whitelist raffles",
  description: "Whitelist spots projects opened to everyone. Complete the tasks and enter.",
};

/** Every public whitelist raffle spawned from a Collab listing. */
export default async function CollabRafflesBrowsePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [params, surface] = await Promise.all([searchParams, getCollabSurface()]);
  const chainParam = typeof params.chain === "string" ? (params.chain.toUpperCase() as Blockchain) : undefined;
  const chain = chainParam && ALL_CHAINS.includes(chainParam) ? chainParam : undefined;
  const sort = params.sort === "new" ? "new" : "ending";
  const liveOnly = params.live === "1";

  let raffles: GiveawayCardData[] = [];
  try {
    raffles = await listPublicGiveaways({ collabOnly: true, chain, sort, liveOnly, take: 48 });
  } catch {
    // DB unavailable — empty state.
  }

  return (
    <main className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-hero-radial opacity-70" />
      <section id="explore" className="container relative scroll-mt-20 py-14">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-scarlet-soft">Open to everyone</p>
        <h1 className="mt-3 font-display text-4xl font-black tracking-tight text-white sm:text-5xl">
          Public whitelist <span className="text-gradient-crimson">raffles</span>
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Spots projects set aside for the community. No project needed — finish the tasks, enter, get drawn.
        </p>

        <div className="mb-8 mt-10">
          <GiveawayFilters chains={ALL_CHAINS} activeChain={chain} sort={sort} liveOnly={liveOnly} />
        </div>

        {raffles.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {raffles.map((g) => (
              <GiveawayCard key={g.id} giveaway={g} href={joinCollabPath(surface.base, `/raffles/${g.slug}`)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/30 px-6 py-20 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-crimson-gradient shadow-glow-red">
              <Ticket className="h-7 w-7 text-white" />
            </div>
            <h3 className="mt-5 font-display text-xl font-semibold text-white">
              {chain || liveOnly ? "No raffles match those filters" : "No public raffles right now"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Projects open raffles for their public slice — check back soon.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

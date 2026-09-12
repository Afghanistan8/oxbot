import type { Metadata } from "next";
import { Layers } from "lucide-react";

import { ALL_CHAINS } from "@/lib/constants";
import { joinCollabPath } from "@/lib/collab/host";
import { getCollabSurface } from "@/lib/collab/surface";
import { parseListingParams, type SearchParams } from "@/lib/collab/params";
import { listPublicListings, type ListingCardData } from "@/server/queries/collab-public";
import { ListingCard } from "@/components/collab/listing-card";
import { ListingFilters } from "@/components/collab/listing-filters";

export const metadata: Metadata = {
  title: "Listings",
  description: "Open whitelist allocations from NFT and token projects.",
};

/** Browse every open whitelist allocation on the desk. */
export default async function CollabListingsBrowsePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [params, surface] = await Promise.all([searchParams, getCollabSurface()]);
  const f = parseListingParams(params);

  let listings: ListingCardData[] = [];
  try {
    listings = await listPublicListings({ chain: f.chain, assetType: f.type, method: f.method, openOnly: f.open, sort: f.sort });
  } catch {
    // DB unavailable — render the empty state.
  }
  const filtered = Boolean(f.chain || f.type || f.method || f.open);

  return (
    <main className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-hero-radial opacity-70" />
      <section id="listings" className="container relative scroll-mt-20 py-14">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-scarlet-soft">The desk</p>
        <h1 className="mt-3 font-display text-4xl font-black tracking-tight text-white sm:text-5xl">
          Whitelist <span className="text-gradient-crimson">listings</span>
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Allocations from NFT and token projects. Request spots for your community, or enter a public raffle.
        </p>

        <div className="mb-8 mt-10">
          <ListingFilters chains={ALL_CHAINS} active={f} />
        </div>

        {listings.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} href={joinCollabPath(surface.base, `/listings/${l.slug}`)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/30 px-6 py-20 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-crimson-gradient shadow-glow-red">
              <Layers className="h-7 w-7 text-white" />
            </div>
            <h3 className="mt-5 font-display text-xl font-semibold text-white">
              {filtered ? "Nothing matches those filters" : "No listings on the desk yet"}
            </h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {filtered ? "Clear a filter, or check back soon." : "Projects are setting up their inventory. Check back soon."}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Layers } from "lucide-react";

import { getCurrentUserId } from "@/lib/session";
import { brandCollab } from "@/lib/brand-collab";
import { absoluteUrl } from "@/lib/utils";
import { joinCollabPath } from "@/lib/collab/host";
import { collabCallbackUrl, collabShareUrl, getCollabSurface, mainSiteHref } from "@/lib/collab/surface";
import { getPublicGiveaway } from "@/server/queries/public-giveaway";
import { GiveawayDetailView } from "@/components/giveaway/giveaway-detail-view";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const giveaway = await getPublicGiveaway(slug, null);
  if (!giveaway) return { title: "Raffle not found" };
  const title = `${giveaway.title} · ${giveaway.team.name}`;
  const description = giveaway.description?.slice(0, 180) ?? `${giveaway.prize} — enter on ${brandCollab.name}.`;
  const image = giveaway.bannerUrl ? absoluteUrl(giveaway.bannerUrl) : absoluteUrl("/og-default.jpg");
  return {
    title,
    description,
    openGraph: { title, description, url: collabShareUrl(`/raffles/${slug}`), siteName: brandCollab.name, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/**
 * A public whitelist raffle on the Collab surface. It's a normal giveaway, so
 * the page is oxbot's giveaway view (same tasks, wizard, winners) with Collab
 * chrome and a link back to the listing it distributes spots for.
 */
export default async function CollabRafflePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [viewerId, surface] = await Promise.all([getCurrentUserId(), getCollabSurface()]);
  const giveaway = await getPublicGiveaway(slug, viewerId);
  if (!giveaway) notFound();
  // Plain giveaways live on oxbot proper.
  if (!giveaway.listing) redirect(await mainSiteHref(`/giveaways/${slug}`));

  const returnPath = await collabCallbackUrl(`/raffles/${slug}`);

  return (
    <GiveawayDetailView
      giveaway={giveaway}
      viewerId={viewerId}
      returnPath={returnPath}
      aboveTitle={
        <Link
          href={joinCollabPath(surface.base, `/listings/${giveaway.listing.slug}`)}
          className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold backdrop-blur transition-colors hover:bg-gold/20"
        >
          <Layers className="h-3.5 w-3.5" />
          Public slice of {giveaway.listing.title}
        </Link>
      }
    />
  );
}

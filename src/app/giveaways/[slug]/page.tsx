import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getCurrentUserId } from "@/lib/session";
import { getPublicGiveaway } from "@/server/queries/public-giveaway";
import { absoluteUrl } from "@/lib/utils";
import { brand } from "@/lib/brand";

import { SiteHeader } from "@/components/brand/site-header";
import { SiteFooter } from "@/components/brand/site-footer";
import { GiveawayDetailView } from "@/components/giveaway/giveaway-detail-view";
import { ProfileCompletionNotice } from "@/components/profile/profile-completion-notice";

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

  return (
    <>
      <SiteHeader />
      {viewerId && (
        <div className="container">
          {/* Renders only while the profile is incomplete; otherwise nothing. */}
          <ProfileCompletionNotice userId={viewerId} className="mt-6" />
        </div>
      )}
      <GiveawayDetailView giveaway={giveaway} viewerId={viewerId} returnPath={`/giveaways/${slug}`} />
      <SiteFooter />
    </>
  );
}

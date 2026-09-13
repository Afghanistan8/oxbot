import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getCurrentUserId } from "@/lib/session";
import { db } from "@/lib/db";
import { absoluteUrl } from "@/lib/utils";
import { joinCollabPath } from "@/lib/collab/host";
import { collabSignInHref, getCollabSurface } from "@/lib/collab/surface";
import { isAcceptingRequests } from "@/lib/collab/constants";
import { getPublicListing } from "@/server/queries/collab-public";
import { Button } from "@/components/ui/button";
import { RequestForm } from "@/components/collab/request-form";

export const metadata = { title: "Request allocation" };

/** File a partner request against a listing. Signed-in team members only. */
export default async function RequestAllocationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [viewerId, surface] = await Promise.all([getCurrentUserId(), getCollabSurface()]);
  const listingHref = joinCollabPath(surface.base, `/listings/${slug}`);

  if (!viewerId) redirect(await collabSignInHref(`/listings/${slug}/request`));

  const [listing, viewer] = await Promise.all([
    getPublicListing(slug, viewerId),
    db.user.findUnique({ where: { id: viewerId }, select: { name: true, email: true } }),
  ]);
  if (!listing) notFound();
  if (listing.viewerIsOwner || listing.requesterTeams.length === 0) redirect(listingHref);

  // Not redirected: submitting revalidates this page, and the form must stay
  // mounted to show its confirmation even though the team now has a request.
  const blockedReason = !isAcceptingRequests(listing)
    ? "This listing isn't accepting requests right now."
    : !listing.requesterTeams.some((t) => !t.hasActiveRequest)
      ? "Each of your projects already has an active request on this listing."
      : null;

  return (
    <main className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-hero-radial opacity-60" />
      <div className="container relative py-10">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground">
          <Link href={listingHref}>
            <ArrowLeft className="h-4 w-4" />
            {listing.title}
          </Link>
        </Button>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-scarlet-soft">Request allocation</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Pitch <span className="text-gradient-crimson">{listing.team.name}</span>
        </h1>
        <p className="mb-8 mt-2 max-w-xl text-sm text-muted-foreground">
          Tell them who you are and what you&apos;ll do with the spots. Your score updates as you type.
        </p>

        <RequestForm
          listing={{
            id: listing.id,
            title: listing.title,
            teamName: listing.team.name,
            chain: listing.chain,
            spotsPerRequestMin: listing.spotsPerRequestMin,
            spotsPerRequestMax: listing.spotsPerRequestMax,
            available: listing.available,
            distributionMethod: listing.distributionMethod,
          }}
          teams={listing.requesterTeams}
          criteria={listing.criteria}
          dashboardBase={surface.onCollabHost ? absoluteUrl("").replace(/\/$/, "") : ""}
          listingHref={listingHref}
          blockedReason={blockedReason}
          defaultContact={{ name: viewer?.name ?? "", email: viewer?.email ?? "" }}
        />
      </div>
    </main>
  );
}

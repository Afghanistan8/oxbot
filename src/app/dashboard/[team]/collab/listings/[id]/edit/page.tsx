import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { resolveTeamPage } from "@/server/queries/require-team-page";
import { getManagedListing } from "@/server/queries/collab";
import { PageHeader } from "@/components/dashboard/page-header";
import { ListingForm } from "@/components/collab/listing-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Edit Collab listing" };

export default async function EditListingPage({ params }: { params: Promise<{ team: string; id: string }> }) {
  const { team: slug, id } = await params;
  const { team } = await resolveTeamPage(slug, "COLLAB_MANAGER");
  const listing = await getManagedListing(team.id, id);
  if (!listing || listing.status === "CANCELLED") notFound();

  return (
    <div className="max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
        <Link href={`/dashboard/${slug}/collab/listings/${id}`}>
          <ArrowLeft className="h-4 w-4" />
          Back to listing
        </Link>
      </Button>
      <PageHeader title="Edit listing" description={listing.title} />
      <ListingForm
        mode="edit"
        teamId={team.id}
        listing={listing}
        team={{
          name: team.name,
          slug: team.slug,
          logoUrl: team.logoUrl,
          primaryChain: team.primaryChain,
          chains: team.chains,
          totalSupply: team.totalSupply,
          mintPrice: team.mintPrice,
          mintAt: team.mintAt,
          xHandle: team.xHandle,
          discordInvite: team.discordInvite,
        }}
      />
    </div>
  );
}

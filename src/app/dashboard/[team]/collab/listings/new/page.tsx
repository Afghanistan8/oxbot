import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { resolveTeamPage } from "@/server/queries/require-team-page";
import { getCriteriaTemplates } from "@/server/queries/collab";
import { PageHeader } from "@/components/dashboard/page-header";
import { ListingForm } from "@/components/collab/listing-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "New Collab listing" };

/** Create a whitelist listing. EDITOR+. Identity is prefilled from the team profile. */
export default async function NewListingPage({ params }: { params: Promise<{ team: string }> }) {
  const { team: slug } = await params;
  const { team } = await resolveTeamPage(slug, "EDITOR");
  const templates = await getCriteriaTemplates(team.id);

  return (
    <div className="max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
        <Link href={`/dashboard/${slug}/collab/listings`}>
          <ArrowLeft className="h-4 w-4" />
          Back to listings
        </Link>
      </Button>
      <PageHeader title="List inventory" description="Spots, distribution, criteria, and the request window." />
      <ListingForm
        mode="create"
        teamId={team.id}
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
        templates={templates}
      />
    </div>
  );
}

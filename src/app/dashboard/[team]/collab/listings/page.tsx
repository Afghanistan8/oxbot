import Link from "next/link";
import { Layers, Plus } from "lucide-react";

import { resolveTeamPage } from "@/server/queries/require-team-page";
import { getTeamListings } from "@/server/queries/collab";
import { PageHeader } from "@/components/dashboard/page-header";
import { DashboardListingRow } from "@/components/collab/listing-row";
import { CollabEmptyState } from "@/components/collab/collab-empty-state";
import { Button } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  return { title: `${team} · Collab listings` };
}

/** Every whitelist listing the team has created, newest first. */
export default async function CollabListingsPage({ params }: { params: Promise<{ team: string }> }) {
  const { team: slug } = await params;
  const { team } = await resolveTeamPage(slug, "COLLAB_MANAGER");
  const listings = await getTeamListings(team.id);

  return (
    <>
      <PageHeader title="Listings" description="Your whitelist inventory on the Collab desk.">
        <Button asChild size="sm">
          <Link href={`/dashboard/${slug}/collab/listings/new`}>
            <Plus className="h-4 w-4" />
            New listing
          </Link>
        </Button>
      </PageHeader>

      {listings.length > 0 ? (
        <div className="space-y-3">
          {listings.map((l) => (
            <DashboardListingRow key={l.id} listing={l} teamSlug={slug} />
          ))}
        </div>
      ) : (
        <CollabEmptyState
          icon={Layers}
          title="No listings yet"
          body="List whitelist spots once — partners request, you approve, the desk keeps count."
          action={{ href: `/dashboard/${slug}/collab/listings/new`, label: "List inventory" }}
        />
      )}
    </>
  );
}

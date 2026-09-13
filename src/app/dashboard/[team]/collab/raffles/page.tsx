import Link from "next/link";
import { ExternalLink, Settings2, Ticket, Trophy, Users } from "lucide-react";

import { resolveTeamPage } from "@/server/queries/require-team-page";
import { getTeamPublicRaffles, type TeamPublicRaffleRow } from "@/server/queries/collab";
import { giveawayPhase, PHASE_META } from "@/lib/format";
import { collabEntryUrl } from "@/lib/collab/surface";
import { formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChainBadge } from "@/components/giveaway/chain-badge";
import { CollabEmptyState } from "@/components/collab/collab-empty-state";
import { PublicRaffleForm } from "@/components/collab/public-raffle-form";

export const metadata = { title: "Public raffles" };

/**
 * Public whitelist raffles spawned from listings. Each is a normal giveaway —
 * manage entrants, draw and export winners from the giveaway page.
 */
export default async function CollabRafflesPage({ params }: { params: Promise<{ team: string }> }) {
  const { team: slug } = await params;
  const { team } = await resolveTeamPage(slug);
  const rows = await getTeamPublicRaffles(team.id);

  return (
    <>
      <PageHeader
        title="Public raffles"
        description="Open a listing's public slice to everyone. Winners, draws and exports use the standard giveaway tools."
      />

      {rows.length === 0 ? (
        <CollabEmptyState
          icon={Ticket}
          title="No public slices yet"
          body="Give a listing a public raffle slice (Edit → Spots) and open the raffle here."
          action={{ href: `/dashboard/${slug}/collab/listings`, label: "Your listings" }}
        />
      ) : (
        <div className="space-y-6">
          {rows.map((row) => (
            <RaffleCard key={row.listing.id} row={row} teamSlug={slug} team={team} />
          ))}
        </div>
      )}
    </>
  );
}

function RaffleCard({
  row,
  teamSlug,
  team,
}: {
  row: TeamPublicRaffleRow;
  teamSlug: string;
  team: { xHandle: string | null; discordGuildId: string | null };
}) {
  const { listing, raffle } = row;

  if (raffle) {
    const phase = giveawayPhase(raffle);
    const meta = PHASE_META[phase];
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Badge variant={meta.badge}>{meta.label}</Badge>
              <ChainBadge chain={listing.chain} showLabel={false} />
              <span className="text-xs text-muted-foreground">for {listing.title}</span>
            </div>
            <p className="truncate font-display text-lg font-semibold text-white">{raffle.title}</p>
            <div className="mt-1 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5" />
                {formatNumber(raffle.winnersCount)} spots
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {formatNumber(raffle.entryCount)} entries
              </span>
              {raffle.winnerCount > 0 && <span className="text-gold">{formatNumber(raffle.winnerCount)} winners drawn</span>}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {raffle.status !== "DRAFT" && (
              <Button asChild variant="outline" size="sm">
                <a href={collabEntryUrl(`/raffles/${raffle.slug}`)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  View
                </a>
              </Button>
            )}
            <Button asChild size="sm">
              <Link href={`/dashboard/${teamSlug}/giveaways/${raffle.id}`}>
                <Settings2 className="h-4 w-4" />
                Manage &amp; draw
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const holding =
    listing.assetType === "NFT" && listing.collectionAddress
      ? { type: "NFT_HOLD" as const, chain: listing.chain, contractAddress: listing.collectionAddress, label: listing.collectionName ?? "" }
      : listing.assetType === "TOKEN" && listing.tokenAddress
        ? { type: "TOKEN_BALANCE" as const, chain: listing.chain, contractAddress: listing.tokenAddress, label: listing.tokenSymbol ?? "" }
        : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <ChainBadge chain={listing.chain} showLabel={false} />
          <span className="text-xs text-muted-foreground">{listing.title}</span>
        </div>
        <CardTitle className="text-base">Open a public raffle for {formatNumber(listing.publicSpots)} spots</CardTitle>
        <CardDescription>
          Prize reads “GTD whitelist x {listing.publicSpots}”. Entrants complete the tasks below; you draw and export from the giveaway page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {listing.status === "DRAFT" ? (
          <p className="text-sm text-muted-foreground">Publish the listing first, then open its raffle.</p>
        ) : (
          <PublicRaffleForm
            listingId={listing.id}
            publicSpots={listing.publicSpots}
            defaults={{ startAt: listing.startAt, endAt: listing.endAt, xHandle: team.xHandle, holding }}
            discordServerId={team.discordGuildId ?? ""}
          />
        )}
      </CardContent>
    </Card>
  );
}

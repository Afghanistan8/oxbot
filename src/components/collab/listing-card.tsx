"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Layers, Users } from "lucide-react";

import type { ListingCardData } from "@/server/queries/collab-public";
import { LISTING_PHASE_META, listingPhase } from "@/lib/collab/constants";
import { formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChainBadge } from "@/components/giveaway/chain-badge";
import { Countdown } from "@/components/giveaway/countdown";
import { AssetTypeChip, MethodChip, PublicRaffleChip } from "@/components/collab/collab-chips";
import { InventoryBar } from "@/components/collab/inventory-bar";

/**
 * ListingCard — the Collab desk card. Same rhythm as GiveawayCard: banner with
 * sheen, status + chain badges, project line, title, spots meter, countdown.
 */
export function ListingCard({ listing, href }: { listing: ListingCardData; href: string }) {
  const phase = listingPhase(listing);
  const phaseMeta = LISTING_PHASE_META[phase];
  const raffleOpen =
    listing.publicRaffle?.status === "ACTIVE" && new Date(listing.publicRaffle.endAt).getTime() > Date.now();
  const assetLabel = listing.assetType === "TOKEN" ? listing.tokenSymbol : listing.collectionName;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      whileHover={{ y: -4 }}
      className="group relative"
    >
      <Link
        href={href}
        className="block overflow-hidden rounded-2xl border border-border bg-card bg-card-glow shadow-card transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-glow-red"
      >
        <div className="relative aspect-[16/9] overflow-hidden bg-ink-charcoal">
          {listing.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.bannerUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-crimson-gradient/20">
              <Layers className="h-10 w-10 text-primary/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-black via-ink-black/20 to-transparent" />
          <div className="absolute inset-0 bg-crimson-sheen opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          <div className="absolute left-3 top-3 flex items-center gap-2">
            <Badge variant={phaseMeta.badge}>
              {phase === "open" && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-scarlet opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-scarlet" />
                </span>
              )}
              {phaseMeta.label}
            </Badge>
          </div>
          <div className="absolute right-3 top-3">
            <ChainBadge chain={listing.chain} showLabel={false} />
          </div>
          {raffleOpen && (
            <div className="absolute bottom-3 left-3">
              <PublicRaffleChip />
            </div>
          )}
        </div>

        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Avatar className="h-5 w-5">
              {listing.team.logoUrl && <AvatarImage src={listing.team.logoUrl} alt="" />}
              <AvatarFallback className="text-[9px]">{listing.team.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="truncate">{listing.team.name}</span>
            {assetLabel && (
              <>
                <span className="text-border">•</span>
                <span className="truncate text-scarlet-soft/80">{assetLabel}</span>
              </>
            )}
          </div>

          <h3 className="line-clamp-2 font-display text-lg font-semibold leading-snug tracking-tight text-white">
            {listing.title}
          </h3>

          <div className="flex flex-wrap items-center gap-1.5">
            <MethodChip method={listing.distributionMethod} />
            <AssetTypeChip assetType={listing.assetType} />
          </div>

          <div className="space-y-1.5 rounded-xl border border-border/70 bg-ink-black/40 px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-semibold text-white">
                {formatNumber(listing.available)}
                <span className="font-normal text-muted-foreground"> / {formatNumber(listing.totalSpots)} spots left</span>
              </span>
              {listing.requestCount !== null && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {formatNumber(listing.requestCount)}
                </span>
              )}
            </div>
            <InventoryBar listing={listing} showLegend={false} />
          </div>

          <div className="pt-1">
            {phase === "open" || phase === "allocated" || phase === "paused" ? (
              <Countdown target={listing.endAt} compact endedLabel="Closed" />
            ) : phase === "upcoming" ? (
              <div className="flex items-center gap-2 text-xs text-amber-300">
                <span>Opens in</span>
                <Countdown target={listing.startAt} compact />
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Requests closed</span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

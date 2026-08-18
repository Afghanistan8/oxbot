"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Gift, Users, Trophy } from "lucide-react";

import type { GiveawayCardData } from "@/types/giveaway";
import { GIVEAWAY_TYPE_META } from "@/lib/constants";
import { giveawayPhase, PHASE_META } from "@/lib/format";
import { formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ChainBadge } from "@/components/giveaway/chain-badge";
import { Countdown } from "@/components/giveaway/countdown";

/**
 * GiveawayCard — the premium card used in the public grid + dashboards.
 * Soft red border, hover glow + lift, banner with crimson sheen overlay,
 * countdown, and privacy-aware entry count.
 */
export function GiveawayCard({ giveaway }: { giveaway: GiveawayCardData }) {
  const phase = giveawayPhase(giveaway);
  const phaseMeta = PHASE_META[phase];
  const typeMeta = GIVEAWAY_TYPE_META[giveaway.type];
  const isFcfs = giveaway.type === "FCFS";
  const spotsLeft = Math.max(0, giveaway.winnersCount - giveaway.fcfsCursor);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      whileHover={{ y: -4 }}
      className="group relative"
    >
      <Link
        href={`/giveaways/${giveaway.slug}`}
        className="block overflow-hidden rounded-2xl border border-border bg-card bg-card-glow shadow-card transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-glow-red"
      >
        {/* Banner */}
        <div className="relative aspect-[16/9] overflow-hidden bg-ink-charcoal">
          {giveaway.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={giveaway.bannerUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-crimson-gradient/20">
              <Gift className="h-10 w-10 text-primary/40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-black via-ink-black/20 to-transparent" />
          <div className="absolute inset-0 bg-crimson-sheen opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Status + type */}
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <Badge variant={phaseMeta.badge}>
              {phase === "live" && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-scarlet opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-scarlet" />
                </span>
              )}
              {phaseMeta.label}
            </Badge>
          </div>
          <div className="absolute right-3 top-3">
            <ChainBadge chain={giveaway.chain} showLabel={false} />
          </div>
        </div>

        {/* Body */}
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="truncate">by {giveaway.team.name}</span>
            <span className="text-border">•</span>
            <span className="text-scarlet-soft/80">{typeMeta.label}</span>
          </div>

          <h3 className="line-clamp-2 font-display text-lg font-semibold leading-snug tracking-tight text-white">
            {giveaway.title}
          </h3>

          <div className="flex items-start gap-2 rounded-xl border border-border/70 bg-ink-black/40 px-3 py-2">
            <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <p className="line-clamp-2 text-sm text-foreground/90">
              {giveaway.prize}
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Trophy className="h-3.5 w-3.5" />
                {giveaway.winnersCount} {isFcfs ? "slot" : "winner"}
                {giveaway.winnersCount === 1 ? "" : "s"}
              </span>
              {!giveaway.hideEntryCount && giveaway.entryCount !== null && (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {formatNumber(giveaway.entryCount)}
                </span>
              )}
            </div>
          </div>

          {/* Countdown / spots / ended */}
          <div className="pt-1">
            {phase === "live" &&
              (isFcfs ? (
                <span className="text-xs font-medium text-scarlet-soft">
                  {formatNumber(spotsLeft)} of {formatNumber(giveaway.winnersCount)} spots left
                </span>
              ) : (
                <Countdown target={giveaway.endAt} compact endedLabel="Ended" />
              ))}
            {phase === "upcoming" && (
              <div className="flex items-center gap-2 text-xs text-amber-300">
                <span>Starts in</span>
                <Countdown target={giveaway.startAt} compact />
              </div>
            )}
            {(phase === "ended" || phase === "finalized") && (
              <span className="text-xs text-muted-foreground">
                {phase === "finalized"
                  ? "Winners announced"
                  : isFcfs
                    ? "All spots claimed"
                    : "Entry closed"}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

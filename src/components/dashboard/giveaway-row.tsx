import Link from "next/link";
import { Gift, Users, Trophy, Eye, EyeOff, Lock } from "lucide-react";

import type { DashboardGiveaway } from "@/server/queries/dashboard";
import { GIVEAWAY_TYPE_META } from "@/lib/constants";
import { giveawayPhase, PHASE_META } from "@/lib/format";
import { formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ChainBadge } from "@/components/giveaway/chain-badge";

/**
 * DashboardGiveawayRow — a compact founder-side row linking into management.
 * Shows real (private) entry counts, since only team members see this.
 */
export function DashboardGiveawayRow({
  giveaway,
  teamSlug,
}: {
  giveaway: DashboardGiveaway;
  teamSlug: string;
}) {
  const phase = giveawayPhase(giveaway);
  const phaseMeta = PHASE_META[phase];
  const typeMeta = GIVEAWAY_TYPE_META[giveaway.type];

  return (
    <Link
      href={`/dashboard/${teamSlug}/giveaways/${giveaway.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card/60 p-4 transition-all duration-200 hover:border-primary/50 hover:bg-card"
    >
      {/* Thumbnail */}
      <div className="relative hidden h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-ink-charcoal sm:block">
        {giveaway.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={giveaway.bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-crimson-gradient/20">
            <Gift className="h-5 w-5 text-primary/40" />
          </div>
        )}
      </div>

      {/* Main */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant={phaseMeta.badge}>{phaseMeta.label}</Badge>
          <span className="text-xs text-scarlet-soft/80">{typeMeta.label}</span>
          {giveaway.visibility === "PRIVATE" && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Private
            </span>
          )}
        </div>
        <h3 className="mt-1 truncate font-display text-base font-semibold text-white">
          {giveaway.title}
        </h3>
        <p className="truncate text-xs text-muted-foreground">{giveaway.prize}</p>
      </div>

      {/* Stats */}
      <div className="hidden items-center gap-5 text-sm md:flex">
        <Stat icon={Users} label="Entries" value={formatNumber(giveaway.entryCount)} />
        <Stat
          icon={Trophy}
          label="Winners"
          value={`${giveaway.winnerCount}/${giveaway.winnersCount}`}
        />
        <div className="flex items-center" title={giveaway.hideEntryCount ? "Count hidden publicly" : "Count public"}>
          {giveaway.hideEntryCount ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      <ChainBadge chain={giveaway.chain} showLabel={false} />
    </Link>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-white">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

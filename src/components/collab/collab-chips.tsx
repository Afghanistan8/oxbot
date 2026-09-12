import { Dices, Hand, ListChecks, Zap, Gem, Coins, Package, Ticket } from "lucide-react";
import type { AssetType, DistributionMethod } from "@prisma/client";

import { ASSET_TYPE_META, METHOD_META } from "@/lib/collab/constants";
import { cn } from "@/lib/utils";

/** Small pill chips shared by listing cards, detail pages and dashboard rows. */

const METHOD_ICON = { FCFS: Zap, CRITERIA: ListChecks, RAFFLE: Dices, MANUAL: Hand } as const;
const ASSET_ICON = { NFT: Gem, TOKEN: Coins, OTHER: Package } as const;

const chip =
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

export function MethodChip({ method, className }: { method: DistributionMethod; className?: string }) {
  const Icon = METHOD_ICON[method];
  return (
    <span className={cn(chip, "border-primary/30 bg-primary/10 text-scarlet-soft", className)}>
      <Icon className="h-3 w-3" />
      {METHOD_META[method].short}
    </span>
  );
}

export function AssetTypeChip({ assetType, className }: { assetType: AssetType; className?: string }) {
  const Icon = ASSET_ICON[assetType];
  return (
    <span className={cn(chip, "border-border bg-ink-black/50 text-foreground/90", className)}>
      <Icon className="h-3 w-3 text-muted-foreground" />
      {ASSET_TYPE_META[assetType].label}
    </span>
  );
}

export function PublicRaffleChip({ className }: { className?: string }) {
  return (
    <span className={cn(chip, "border-transparent bg-gold/15 text-gold ring-1 ring-inset ring-gold/30", className)}>
      <Ticket className="h-3 w-3" />
      Public raffle open
    </span>
  );
}

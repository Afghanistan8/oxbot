import { Gem, Coins, Package } from "lucide-react";
import type { AssetType } from "@prisma/client";

import { ASSET_TYPE_META } from "@/lib/collab/constants";
import { cn } from "@/lib/utils";

/** Small pill chips shared by listing cards, detail pages and dashboard rows. */

const ASSET_ICON = { NFT: Gem, TOKEN: Coins, OTHER: Package } as const;

const chip =
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

export function AssetTypeChip({ assetType, className }: { assetType: AssetType; className?: string }) {
  const Icon = ASSET_ICON[assetType];
  return (
    <span className={cn(chip, "border-border bg-ink-black/50 text-foreground/90", className)}>
      <Icon className="h-3 w-3 text-muted-foreground" />
      {ASSET_TYPE_META[assetType].label}
    </span>
  );
}

import type { Blockchain } from "@prisma/client";

import { CHAIN_META } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * ChainBadge — a small chain indicator with the chain's brand color as a dot.
 */
export function ChainBadge({
  chain,
  className,
  showLabel = true,
}: {
  chain: Blockchain;
  className?: string;
  showLabel?: boolean;
}) {
  const meta = CHAIN_META[chain];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-ink-black/50 px-2.5 py-0.5 text-xs font-medium text-foreground/90",
        className
      )}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: meta.color, boxShadow: `0 0 8px ${meta.color}80` }}
      />
      {showLabel ? meta.label : meta.short}
    </span>
  );
}

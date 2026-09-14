import { availableSpots, type InventoryCounts } from "@/lib/collab/constants";
import { cn, formatNumber } from "@/lib/utils";

/**
 * InventoryBar — a listing's spots as one stacked bar: confirmed/delivered,
 * reserved, and what's still available to partners.
 */
export function InventoryBar({
  listing,
  showLegend = true,
  className,
}: {
  listing: InventoryCounts;
  showLegend?: boolean;
  className?: string;
}) {
  const total = Math.max(1, listing.totalSpots);
  const available = availableSpots(listing);
  const segments = [
    { key: "allocated", label: "Allocated", value: listing.allocatedSpots, className: "bg-gold" },
    { key: "reserved", label: "Reserved", value: listing.reservedSpots, className: "bg-gold/50" },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-black/60 ring-1 ring-inset ring-border">
        {segments.map((s) =>
          s.value > 0 ? (
            <div
              key={s.key}
              className={s.className}
              style={{ width: `${(s.value / total) * 100}%` }}
              title={`${s.label}: ${formatNumber(s.value)}`}
            />
          ) : null
        )}
      </div>
      {showLegend && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-white">
            {formatNumber(available)} <span className="font-normal text-muted-foreground">of {formatNumber(listing.totalSpots)} available</span>
          </span>
          {segments.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", s.className)} />
              {s.label} {formatNumber(s.value)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

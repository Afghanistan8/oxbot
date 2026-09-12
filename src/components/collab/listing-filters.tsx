"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AssetType, Blockchain, DistributionMethod } from "@prisma/client";

import { CHAIN_META } from "@/lib/constants";
import { ASSET_TYPES, ASSET_TYPE_META, DISTRIBUTION_METHODS, METHOD_META } from "@/lib/collab/constants";
import { cn } from "@/lib/utils";

/**
 * ListingFilters — URL-driven filter chips for the Collab desk (same pattern
 * as GiveawayFilters): chain, asset type, method, open-now, and sort.
 */
export function ListingFilters({
  chains,
  active,
  anchor = "listings",
}: {
  chains: Blockchain[];
  active: {
    chain?: Blockchain;
    type?: AssetType;
    method?: DistributionMethod;
    open: boolean;
    sort: "ending" | "new" | "spots";
  };
  anchor?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null) params.delete(key);
      else params.set(key, value);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}#${anchor}` : `${pathname}#${anchor}`, { scroll: false });
    },
    [router, pathname, searchParams, anchor]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={!active.chain} onClick={() => setParam("chain", null)}>
          All chains
        </Chip>
        {chains.map((c) => (
          <Chip key={c} active={active.chain === c} onClick={() => setParam("chain", active.chain === c ? null : c)}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHAIN_META[c].color }} />
            {CHAIN_META[c].label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {ASSET_TYPES.filter((t) => t !== "OTHER").map((t) => (
            <Chip key={t} active={active.type === t} onClick={() => setParam("type", active.type === t ? null : t)}>
              {ASSET_TYPE_META[t].label}
            </Chip>
          ))}
          <div className="hidden h-5 w-px bg-border sm:block" />
          {DISTRIBUTION_METHODS.map((m) => (
            <Chip key={m} active={active.method === m} onClick={() => setParam("method", active.method === m ? null : m)}>
              {METHOD_META[m].short}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip active={active.open} onClick={() => setParam("open", active.open ? null : "1")}>
            <span className="relative flex h-1.5 w-1.5">
              <span
                className={cn(
                  "absolute inline-flex h-full w-full rounded-full",
                  active.open ? "animate-ping bg-scarlet opacity-70" : "bg-muted-foreground/40"
                )}
              />
              <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", active.open ? "bg-scarlet" : "bg-muted-foreground/60")} />
            </span>
            Spots left
          </Chip>
          <div className="hidden h-5 w-px bg-border sm:block" />
          <Chip active={active.sort === "ending"} onClick={() => setParam("sort", null)}>
            Ending soon
          </Chip>
          <Chip active={active.sort === "spots"} onClick={() => setParam("sort", "spots")}>
            Most spots
          </Chip>
          <Chip active={active.sort === "new"} onClick={() => setParam("sort", "new")}>
            Newest
          </Chip>
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200",
        active
          ? "border-primary/60 bg-primary/15 text-white shadow-glow-red"
          : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

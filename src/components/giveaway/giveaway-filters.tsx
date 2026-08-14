"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

import { cn } from "@/lib/utils";
import { CHAIN_META } from "@/lib/constants";
import type { Blockchain } from "@prisma/client";

/**
 * GiveawayFilters — client filter chips for the public grid. Writes selections
 * into the URL query string so the server component re-queries with the filter.
 */
export function GiveawayFilters({
  chains,
  activeChain,
  sort,
  liveOnly,
}: {
  chains: Blockchain[];
  activeChain?: Blockchain;
  sort: "ending" | "new";
  liveOnly: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}#explore` : `${pathname}#explore`, {
        scroll: false,
      });
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Chain chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          active={!activeChain}
          onClick={() => setParam("chain", null)}
        >
          All chains
        </Chip>
        {chains.map((c) => (
          <Chip
            key={c}
            active={activeChain === c}
            onClick={() => setParam("chain", activeChain === c ? null : c)}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: CHAIN_META[c].color }}
            />
            {CHAIN_META[c].label}
          </Chip>
        ))}
      </div>

      {/* Sort + live toggle */}
      <div className="flex items-center gap-2">
        <Chip
          active={liveOnly}
          onClick={() => setParam("live", liveOnly ? null : "1")}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full",
                liveOnly ? "animate-ping bg-scarlet opacity-70" : "bg-muted-foreground/40"
              )}
            />
            <span
              className={cn(
                "relative inline-flex h-1.5 w-1.5 rounded-full",
                liveOnly ? "bg-scarlet" : "bg-muted-foreground/60"
              )}
            />
          </span>
          Live now
        </Chip>
        <div className="hidden h-5 w-px bg-border sm:block" />
        <Chip
          active={sort === "ending"}
          onClick={() => setParam("sort", "ending")}
        >
          Ending soon
        </Chip>
        <Chip active={sort === "new"} onClick={() => setParam("sort", "new")}>
          Newest
        </Chip>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
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

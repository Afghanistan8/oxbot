"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import type { EntryStatsRange } from "@/server/queries/dashboard";

const OPTIONS: { value: EntryStatsRange; label: string }[] = [
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

/** Writes the selected range into ?range=, so the server component re-queries. */
export function EntryStatsRangeTabs({ active }: { active: EntryStatsRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(range: EntryStatsRange) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", range);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card/40 p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => select(o.value)}
          className={cn(
            "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-200",
            active === o.value
              ? "bg-primary/15 text-white shadow-glow-red"
              : "text-muted-foreground hover:text-white"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

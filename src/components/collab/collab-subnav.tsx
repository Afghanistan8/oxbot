"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * CollabSubnav — section tabs across every `/dashboard/[team]/collab` page.
 * Scrolls horizontally on small screens instead of wrapping.
 */
const TABS = [
  { href: "", label: "Overview", exact: true },
  { href: "/listings", label: "Listings" },
  { href: "/requests", label: "Incoming" },
  { href: "/outgoing", label: "Outgoing" },
  { href: "/raffles", label: "Public raffles" },
  { href: "/allocations", label: "Allocations" },
  { href: "/criteria", label: "Criteria templates" },
] as const;

export function CollabSubnav({ counts }: { counts?: { incoming?: number; outgoing?: number } }) {
  const pathname = usePathname();
  const params = useParams<{ team: string }>();
  const base = `/dashboard/${params.team}/collab`;

  return (
    <div className="-mx-1 mb-8 overflow-x-auto pb-1">
      <nav className="flex min-w-max items-center gap-1 rounded-2xl border border-border bg-card/40 p-1">
        {TABS.map((tab) => {
          const href = `${base}${tab.href}`;
          const active = "exact" in tab && tab.exact ? pathname === href : pathname.startsWith(href);
          const badge =
            tab.href === "/requests" ? counts?.incoming : tab.href === "/outgoing" ? counts?.outgoing : undefined;
          return (
            <Link
              key={tab.href}
              href={href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/15 text-white shadow-glow-red"
                  : "text-muted-foreground hover:bg-accent/30 hover:text-white"
              )}
            >
              {tab.label}
              {badge ? (
                <span className="rounded-full bg-primary/20 px-1.5 text-[10px] font-semibold tabular-nums text-scarlet-soft">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

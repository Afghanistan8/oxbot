import { Trophy, Crown } from "lucide-react";

import type { PublicWinner } from "@/server/queries/public-giveaway";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * WinnersList — display-safe winner reveal for finalized giveaways.
 * Shows only public identity (name + avatar); never entrant internals.
 */
export function WinnersList({ winners }: { winners: PublicWinner[] }) {
  if (winners.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gold/30 bg-gold/[0.04] p-6 shadow-card">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-gold" />
        <h2 className="font-display text-lg font-semibold text-white">
          Winner{winners.length === 1 ? "" : "s"}
        </h2>
      </div>
      <ul className="space-y-2.5">
        {winners.map((w) => (
          <li
            key={w.rank}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3",
              w.rank === 1
                ? "border-gold/40 bg-gold/10"
                : "border-border bg-ink-black/30"
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-black/60 font-display text-sm font-bold tabular-nums text-gold">
              {w.rank}
            </span>
            <Avatar className="h-8 w-8">
              {w.image && <AvatarImage src={w.image} alt="" />}
              <AvatarFallback>{initials(w.name)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
              {w.name ?? "Anonymous"}
            </span>
            {w.rank === 1 && <Crown className="h-4 w-4 shrink-0 text-gold" />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

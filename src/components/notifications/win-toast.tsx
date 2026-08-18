"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Trophy, PartyPopper } from "lucide-react";

import { markWinsNotifiedAction } from "@/server/actions/profile";
import type { UnnotifiedWin } from "@/server/queries/profile";

/**
 * Shows a stylish "you won!" toast for every giveaway the viewer has won but
 * hasn't been notified about yet — fires on mount, so it appears the moment
 * they land on ANY page after signing in, not just the giveaway's own page.
 * Each toast is stamped as notified server-side right after it renders, so a
 * refresh or a visit to another page never re-shows it.
 */
export function WinToastNotifier({ wins }: { wins: UnnotifiedWin[] }) {
  // Only fire once per mount, even if the parent re-renders.
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current || wins.length === 0) return;
    firedRef.current = true;

    wins.forEach((win, i) => {
      window.setTimeout(() => {
        toast.custom(
          (id) => (
            <div className="flex w-full max-w-sm items-start gap-3 rounded-2xl border border-gold/40 bg-gradient-to-br from-[#1B1917] to-[#131210] p-4 shadow-glow-gold">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-gradient shadow-glow-gold">
                <Trophy className="h-5 w-5 text-gold-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-gold">
                  You won! <PartyPopper className="h-3.5 w-3.5" />
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-white">
                  {win.giveawayTitle}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {win.prize} · by {win.teamName}
                </p>
                <Link
                  href={`/giveaways/${win.giveawaySlug}`}
                  onClick={() => toast.dismiss(id)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gold hover:text-white"
                >
                  View giveaway →
                </Link>
              </div>
            </div>
          ),
          { duration: 12000 }
        );
      }, i * 600);
    });

    markWinsNotifiedAction(wins.map((w) => w.winnerId));
  }, [wins]);

  return null;
}

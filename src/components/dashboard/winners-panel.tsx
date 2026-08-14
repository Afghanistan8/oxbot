"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Trophy, Crown, Dices, RefreshCw, Loader2, ShieldCheck } from "lucide-react";
import type { GiveawayType, WinnerMethod } from "@prisma/client";

import { drawWinnersAction, rerollWinnersAction } from "@/server/actions/winners";
import { type GiveawayPhase, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * WinnersPanel — founder-side draw / re-roll controls + the (private) winner
 * list. Drawing finalizes the giveaway and makes winners public; re-roll runs a
 * fresh seeded draw. Server actions revalidate; we refresh to reflect state.
 */

export type WinnerDisplay = {
  rank: number;
  name: string | null;
  email: string | null;
  image: string | null;
  method: WinnerMethod;
  seq: number | null;
};

const METHOD_LABEL: Record<WinnerMethod, string> = {
  RANDOM: "Random CSPRNG draw",
  FCFS: "First-come, first-served",
  MANUAL: "Manually selected",
};

export function WinnersPanel({
  giveawayId,
  phase,
  type,
  winnersCount,
  completedCount,
  winners,
  drawnAt,
  drawSeed,
  canManage,
}: {
  giveawayId: string;
  phase: GiveawayPhase;
  type: GiveawayType;
  winnersCount: number;
  completedCount: number;
  winners: WinnerDisplay[];
  drawnAt: Date | null;
  drawSeed: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(
    fn: () => Promise<{ ok: boolean; error?: string; message?: string }>,
    confirmMsg?: string
  ) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Done.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  const hasWinners = winners.length > 0;
  const canDraw = phase === "ended";
  const drawLabel =
    type === "FCFS"
      ? "Lock in first-come winners"
      : `Draw ${winnersCount} winner${winnersCount === 1 ? "" : "s"}`;

  return (
    <Card className="bg-card-glow shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-gold" />
            Winners
          </CardTitle>
          {hasWinners && canManage && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  () => rerollWinnersAction(giveawayId),
                  "Re-roll winners? The current winners are discarded and a fresh draw is run with a new seed."
                )
              }
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Re-roll
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {hasWinners ? (
          <div className="space-y-4">
            <ol className="space-y-2">
              {winners.map((w, i) => (
                <motion.li
                  key={w.rank}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut", delay: Math.min(i, 8) * 0.05 }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                    w.rank === 1 ? "border-gold/30 bg-gold/[0.06]" : "border-border bg-card/40"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                      w.rank === 1 ? "bg-gold/20 text-gold" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {w.rank}
                  </span>
                  <Avatar className="h-8 w-8">
                    {w.image && <AvatarImage src={w.image} alt="" />}
                    <AvatarFallback>{initials(w.name, w.email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {w.name ?? w.email ?? "Anonymous"}
                    </p>
                    {w.email && w.name && (
                      <p className="truncate text-xs text-muted-foreground">{w.email}</p>
                    )}
                  </div>
                  {w.seq !== null && (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      #{w.seq}
                    </span>
                  )}
                  {w.rank === 1 && <Crown className="h-4 w-4 shrink-0 text-gold" />}
                </motion.li>
              ))}
            </ol>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-scarlet-soft" />
                {METHOD_LABEL[winners[0]!.method]}
              </span>
              {drawnAt && <span>Drawn {formatDateTime(drawnAt)}</span>}
              {drawSeed && (
                <span className="font-mono" title={drawSeed}>
                  seed {drawSeed.slice(0, 12)}…
                </span>
              )}
            </div>
          </div>
        ) : canDraw ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Dices className="h-8 w-8 text-scarlet-soft" />
            <div>
              <p className="text-sm font-medium text-white">Ready to draw</p>
              <p className="text-xs text-muted-foreground">
                {completedCount} completed {completedCount === 1 ? "entry is" : "entries are"}{" "}
                eligible.
              </p>
            </div>
            {canManage ? (
              <Button
                disabled={pending || completedCount === 0}
                onClick={() =>
                  run(
                    () => drawWinnersAction(giveawayId),
                    "Draw winners now? This finalizes the giveaway and makes the winners public."
                  )
                }
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trophy className="h-4 w-4" />
                )}
                {drawLabel}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">A team editor can draw the winners.</p>
            )}
          </div>
        ) : (
          <p className="py-2 text-center text-sm text-muted-foreground">
            {phase === "cancelled"
              ? "This giveaway was cancelled."
              : "Winners can be drawn once entry closes."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function initials(name: string | null, email: string | null): string {
  const src = name ?? email ?? "?";
  const parts = src.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

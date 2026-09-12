"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dices, Loader2, ShieldCheck } from "lucide-react";

import { drawPartnerRaffleAction } from "@/server/actions/collab";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { LocalTime } from "@/components/local-time";

/**
 * PartnerRafflePanel — RAFFLE-method listings: shows the qualified pool and
 * runs the seeded draw, or the stored seed once drawn.
 */
export function PartnerRafflePanel({
  listingId,
  qualified,
  available,
  windowEnded,
  drawnAt,
  drawSeed,
  canDraw,
}: {
  listingId: string;
  qualified: number;
  available: number;
  windowEnded: boolean;
  drawnAt: Date | null;
  drawSeed: string | null;
  canDraw: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  async function draw() {
    const ok = await confirm({
      title: "Draw the partner raffle?",
      description: windowEnded
        ? `${qualified} qualified request${qualified === 1 ? "" : "s"} compete for ${available} spots. Winners are granted spots and the listing closes.`
        : `The window is still open. Drawing now closes the listing early — ${qualified} qualified request${qualified === 1 ? "" : "s"} compete for ${available} spots.`,
      confirmLabel: "Draw now",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await drawPartnerRaffleAction(listingId);
      if (res.ok) {
        toast.success(res.message ?? "Drawn.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Dices className="h-4 w-4 text-gold" />
          Partner raffle
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {drawnAt ? (
          <>
            <p className="text-muted-foreground">
              Drawn <LocalTime value={drawnAt} />. Winners were granted spots; the rest are waitlisted.
            </p>
            {drawSeed && (
              <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground" title={drawSeed}>
                <ShieldCheck className="h-3.5 w-3.5 text-scarlet-soft" />
                seed {drawSeed.slice(0, 16)}…
              </p>
            )}
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              {qualified} qualified request{qualified === 1 ? "" : "s"} in the pool for {available} spots. Teams are
              shuffled with a stored CSPRNG seed, then granted in order.
            </p>
            {canDraw && (
              <Button className="w-full" variant={windowEnded ? "gold" : "outline"} disabled={pending || qualified === 0} onClick={draw}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dices className="h-4 w-4" />}
                {windowEnded ? "Draw partners" : "Close & draw early"}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

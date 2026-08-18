"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Rocket, Square, Copy, Ban, Loader2 } from "lucide-react";
import type { GiveawayStatus } from "@prisma/client";

import {
  publishGiveawayAction,
  endGiveawayAction,
  cancelGiveawayAction,
  duplicateGiveawayAction,
} from "@/server/actions/giveaway";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

/**
 * GiveawayActions — lifecycle controls on the founder management page.
 * Buttons shown depend on the current status; destructive transitions confirm
 * first. Server actions revalidate; we refresh to reflect the new state.
 */
export function GiveawayActions({
  giveawayId,
  status,
  canAdmin,
}: {
  giveawayId: string;
  status: GiveawayStatus;
  canAdmin: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  async function run(
    fn: () => Promise<{ ok: boolean; error?: string; message?: string }>,
    confirmMsg?: string
  ) {
    if (confirmMsg && !(await confirm({ description: confirmMsg, variant: "destructive" }))) return;
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

  const canPublish = status === "DRAFT" || status === "SCHEDULED";
  const canEnd = status === "ACTIVE" || status === "SCHEDULED";
  const canCancel = canAdmin && status !== "FINALIZED" && status !== "CANCELLED";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canPublish && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => publishGiveawayAction(giveawayId))}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          Publish
        </Button>
      )}

      {canEnd && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(
              () => endGiveawayAction(giveawayId),
              "End this giveaway now? Entries will close and you can draw winners."
            )
          }
        >
          <Square className="h-4 w-4" />
          End now
        </Button>
      )}

      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run(() => duplicateGiveawayAction(giveawayId))}
      >
        <Copy className="h-4 w-4" />
        Duplicate
      </Button>

      {canCancel && (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          disabled={pending}
          onClick={() =>
            run(
              () => cancelGiveawayAction(giveawayId),
              "Cancel this giveaway? This can't be undone."
            )
          }
        >
          <Ban className="h-4 w-4" />
          Cancel
        </Button>
      )}
    </div>
  );
}

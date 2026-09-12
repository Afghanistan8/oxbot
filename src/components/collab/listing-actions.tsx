"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Loader2, Pause, Play, Rocket, Square } from "lucide-react";
import type { ListingStatus } from "@prisma/client";

import {
  cancelListingAction,
  closeListingAction,
  pauseListingAction,
  publishListingAction,
  resumeListingAction,
} from "@/server/actions/collab";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

/**
 * ListingActions — lifecycle controls on the listing management page.
 * Mirrors GiveawayActions: buttons depend on status, destructive ones confirm.
 */
export function ListingActions({
  listingId,
  status,
  canAdmin,
}: {
  listingId: string;
  status: ListingStatus;
  canAdmin: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  async function run(
    fn: () => Promise<{ ok: boolean; error?: string; message?: string }>,
    confirmMsg?: { description: string; destructive?: boolean; confirmLabel?: string }
  ) {
    if (
      confirmMsg &&
      !(await confirm({
        description: confirmMsg.description,
        confirmLabel: confirmMsg.confirmLabel,
        variant: confirmMsg.destructive ? "destructive" : "default",
      }))
    ) {
      return;
    }
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

  const icon = (Icon: typeof Rocket) => (pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" && (
        <Button size="sm" disabled={pending} onClick={() => run(() => publishListingAction(listingId))}>
          {icon(Rocket)}
          Publish
        </Button>
      )}
      {(status === "OPEN" || status === "ALLOCATED") && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => pauseListingAction(listingId))}>
          {icon(Pause)}
          Pause
        </Button>
      )}
      {status === "PAUSED" && (
        <Button size="sm" disabled={pending} onClick={() => run(() => resumeListingAction(listingId))}>
          {icon(Play)}
          Resume
        </Button>
      )}
      {(status === "OPEN" || status === "PAUSED" || status === "ALLOCATED") && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(() => closeListingAction(listingId), {
              description: "Close this listing? No new requests can be filed and pending requests expire. Granted spots stay granted.",
              confirmLabel: "Close listing",
            })
          }
        >
          <Square className="h-4 w-4" />
          Close
        </Button>
      )}
      {canAdmin && status !== "CANCELLED" && (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          disabled={pending}
          onClick={() =>
            run(() => cancelListingAction(listingId), {
              description: "Cancel this listing? It disappears from the desk and pending requests expire. This can't be undone.",
              destructive: true,
              confirmLabel: "Cancel listing",
            })
          }
        >
          <Ban className="h-4 w-4" />
          Cancel
        </Button>
      )}
    </div>
  );
}

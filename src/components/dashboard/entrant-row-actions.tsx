"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, RotateCcw, Loader2 } from "lucide-react";

import { setEntryDisqualifiedAction } from "@/server/actions/winners";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

/**
 * Per-entrant moderation: disqualify (removes any winner slot) or reinstate.
 * Founder-only; rendered inside the private entrants table.
 */
export function EntrantRowActions({
  entryId,
  disqualified,
}: {
  entryId: string;
  disqualified: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  async function toggle() {
    const next = !disqualified;
    if (
      next &&
      !(await confirm({
        title: "Disqualify this entry?",
        description:
          "If they currently hold a winner slot it will be removed — re-roll to backfill.",
        confirmLabel: "Disqualify",
        variant: "destructive",
      }))
    ) {
      return;
    }
    startTransition(async () => {
      const res = await setEntryDisqualifiedAction(entryId, next);
      if (res.ok) {
        toast.success(res.message ?? "Done.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={toggle}
      className={cn(
        "h-8 px-2 text-muted-foreground",
        disqualified ? "hover:text-emerald-400" : "hover:text-destructive"
      )}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : disqualified ? (
        <RotateCcw className="h-3.5 w-3.5" />
      ) : (
        <Ban className="h-3.5 w-3.5" />
      )}
      {disqualified ? "Reinstate" : "Disqualify"}
    </Button>
  );
}

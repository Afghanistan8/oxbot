"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Loader2 } from "lucide-react";
import type { AllocationStatus } from "@prisma/client";

import { setAllocationStatusAction } from "@/server/actions/collab";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

/**
 * Listing-team row control: revoke an allocation (admins only). Accepting or
 * rejecting a submitted set of winners lives in the review panel below the row.
 */
export function AllocationRowActions({
  allocationId,
  status,
  canRevoke,
}: {
  allocationId: string;
  status: AllocationStatus;
  canRevoke: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  async function revoke() {
    const ok = await confirm({
      description: "Revoke this allocation? The spots return to your listing's inventory and the partner loses them.",
      variant: "destructive",
      confirmLabel: "Revoke",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await setAllocationStatusAction(allocationId, "REVOKED");
      if (res.ok) {
        toast.success(res.message ?? "Updated.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  if (status === "REVOKED" || !canRevoke) return null;

  return (
    <div className="flex items-center justify-end">
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-destructive"
        disabled={pending}
        onClick={revoke}
        aria-label="Revoke allocation"
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

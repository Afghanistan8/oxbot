"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Loader2, PackageCheck, ShieldCheck } from "lucide-react";
import type { AllocationStatus } from "@prisma/client";

import { setAllocationStatusAction } from "@/server/actions/collab";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";

/** Listing-team controls to move an allocation: confirm → delivered, or revoke. */
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

  async function run(to: "CONFIRMED" | "DELIVERED" | "REVOKED") {
    if (
      to === "REVOKED" &&
      !(await confirm({
        description: "Revoke this allocation? The spots return to your listing's inventory and the partner loses them.",
        variant: "destructive",
        confirmLabel: "Revoke",
      }))
    ) {
      return;
    }
    startTransition(async () => {
      const res = await setAllocationStatusAction(allocationId, to);
      if (res.ok) {
        toast.success(res.message ?? "Updated.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  if (status === "REVOKED") return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {status === "RESERVED" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("CONFIRMED")}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
          Confirm
        </Button>
      )}
      {(status === "RESERVED" || status === "CONFIRMED") && (
        <Button size="sm" disabled={pending} onClick={() => run("DELIVERED")}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackageCheck className="h-3.5 w-3.5" />}
          Delivered
        </Button>
      )}
      {canRevoke && (
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          disabled={pending}
          onClick={() => run("REVOKED")}
          aria-label="Revoke allocation"
        >
          <Ban className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

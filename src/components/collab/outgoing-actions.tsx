"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Reply, Undo2, Wallet } from "lucide-react";

import {
  cancelRequestAction,
  replyToRequestAction,
  submitAllocationWalletsAction,
} from "@/server/actions/collab";
import type { ActionState } from "@/server/actions/_result";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormMessage } from "@/components/dashboard/form-message";
import { ImageUploadField } from "@/components/dashboard/image-upload-field";
import { useConfirm } from "@/components/ui/confirm-dialog";

/** Requester-side controls on the outgoing desk: reply, withdraw, submit wallets. */

const initial: ActionState = { ok: false };

function useRefreshOnSuccess(state: ActionState, onSuccess?: () => void) {
  const router = useRouter();
  useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Saved.");
      router.refresh();
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

export function RequestReplyForm({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState(replyToRequestAction.bind(null, requestId), initial);
  useRefreshOnSuccess(state);
  return (
    <form action={formAction} className="space-y-2">
      <FormMessage state={state.ok ? undefined : state} />
      <Label htmlFor={`reply-${requestId}`}>Your reply</Label>
      <Textarea id={`reply-${requestId}`} name="reply" rows={3} maxLength={2000} required placeholder="Answer their question, add links…" />
      <FieldError errors={state.fieldErrors?.reply} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Reply className="h-3.5 w-3.5" />}
        Send reply
      </Button>
    </form>
  );
}

export function WithdrawRequestButton({ requestId, declining }: { requestId: string; declining: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  async function run() {
    const ok = await confirm({
      description: declining
        ? "Decline these spots? They go back to the listing and can't be reclaimed."
        : "Withdraw this request?",
      variant: "destructive",
      confirmLabel: declining ? "Decline spots" : "Withdraw",
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await cancelRequestAction(requestId);
      if (res.ok) {
        toast.success(res.message ?? "Done.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={pending} onClick={run}>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
      {declining ? "Decline spots" : "Withdraw"}
    </Button>
  );
}

export function AllocationWalletsForm({
  allocationId,
  spots,
  existing,
  chainLabel,
  requireRaffle = true,
  existingRaffleUrl = "",
  existingProofUrl = null,
}: {
  allocationId: string;
  spots: number;
  existing: string;
  chainLabel: string;
  /** Partner submissions must attach a raffle link + optional image; a listing
   *  team pasting wallets for a teamless partner does not. */
  requireRaffle?: boolean;
  existingRaffleUrl?: string;
  existingProofUrl?: string | null;
}) {
  const [open, setOpen] = useState(!existing);
  const [value, setValue] = useState(existing);
  const [state, formAction, pending] = useActionState(submitAllocationWalletsAction.bind(null, allocationId), initial);
  useRefreshOnSuccess(state, () => setOpen(false));

  const count = value.split(/\r?\n/).filter((l) => l.split(",")[0]?.trim()).length;

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Wallet className="h-3.5 w-3.5" />
        {requireRaffle ? "Edit submission" : "Edit wallets"}
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state.ok ? undefined : state} />
      <div>
        <Label htmlFor={`wallets-${allocationId}`}>
          Winner wallets <span className="font-normal text-muted-foreground">({chainLabel} · one per line · optional “, label”)</span>
        </Label>
        <Textarea
          id={`wallets-${allocationId}`}
          name="wallets"
          rows={6}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1.5 font-mono text-xs"
          placeholder={"0xabc…123, winner1\n0xdef…456"}
          required
        />
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className={count > spots ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {count} / {spots} winners
          </p>
        </div>
        <FieldError errors={Object.entries(state.fieldErrors ?? {}).find(([k]) => k.startsWith("wallets"))?.[1]} />
      </div>

      {requireRaffle && (
        <>
          <div>
            <Label htmlFor={`raffle-${allocationId}`}>
              Raffle link <span className="text-primary">*</span>{" "}
              <span className="font-normal text-muted-foreground">— proof you ran the giveaway</span>
            </Label>
            <Input
              id={`raffle-${allocationId}`}
              name="raffleUrl"
              type="url"
              inputMode="url"
              defaultValue={existingRaffleUrl}
              placeholder="https://x.com/…  or  your raffle link"
              className="mt-1.5"
              required
            />
            <FieldError errors={state.fieldErrors?.raffleUrl} />
          </div>
          <ImageUploadField
            name="proofImageUrl"
            label="Screenshot (optional)"
            folder="collab-proof"
            defaultValue={existingProofUrl}
            aspect="wide"
          />
          <FieldError errors={state.fieldErrors?.proofImageUrl} />
        </>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending || count === 0 || count > spots}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
          {requireRaffle ? "Submit winners" : "Submit wallets"}
        </Button>
      </div>
    </form>
  );
}

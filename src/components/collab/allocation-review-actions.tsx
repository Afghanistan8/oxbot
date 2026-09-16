"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";

import { reviewAllocationAction } from "@/server/actions/collab";
import type { ActionState } from "@/server/actions/_result";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormMessage } from "@/components/dashboard/form-message";

const initial: ActionState = { ok: false };

/**
 * Listing-team review of a partner's submitted winners + proof. Accept marks it
 * delivered; Reject sends it back with a required reason. The note is optional
 * on accept, required on reject (enforced server-side too).
 */
export function AllocationReviewForm({ allocationId }: { allocationId: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(reviewAllocationAction.bind(null, allocationId), initial);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Done.");
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function submit(outcome: "accept" | "reject") {
    const fd = new FormData();
    fd.set("outcome", outcome);
    fd.set("note", note);
    startTransition(() => formAction(fd));
  }

  const noteTooShort = note.trim().length < 5;

  return (
    <div className="space-y-2">
      <FormMessage state={state.ok ? undefined : state} />
      <Label htmlFor={`review-${allocationId}`}>
        Note <span className="font-normal text-muted-foreground">— shown to the partner (required to reject)</span>
      </Label>
      <Textarea
        id={`review-${allocationId}`}
        name="note"
        rows={2}
        maxLength={1000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Approved — added to the whitelist. / Winners don't match your raffle, please resend."
      />
      <FieldError errors={state.fieldErrors?.note} />
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={pending} onClick={() => submit("accept")}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive"
          disabled={pending || noteTooShort}
          onClick={() => submit("reject")}
          title={noteTooShort ? "Add a reason to reject" : undefined}
        >
          <X className="h-3.5 w-3.5" />
          Reject
        </Button>
      </div>
    </div>
  );
}

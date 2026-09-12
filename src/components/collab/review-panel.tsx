"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Check, Hourglass, Loader2, MessageSquare } from "lucide-react";

import { reviewRequestAction } from "@/server/actions/collab";
import type { ActionState } from "@/server/actions/_result";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormMessage } from "@/components/dashboard/form-message";

/**
 * ReviewPanel — approve (full or partial), reject, ask for info, or waitlist
 * an incoming request. Approval runs the locked inventory transaction server-
 * side, so the spot cap here is a hint — the server is the authority.
 */
type Decision = "approve" | "reject" | "needs_info" | "waitlist";

const DECISIONS: { key: Decision; label: string; icon: typeof Check }[] = [
  { key: "approve", label: "Approve", icon: Check },
  { key: "needs_info", label: "Needs info", icon: MessageSquare },
  { key: "waitlist", label: "Waitlist", icon: Hourglass },
  { key: "reject", label: "Reject", icon: Ban },
];

const initial: ActionState = { ok: false };

export function ReviewPanel({
  requestId,
  spotsRequested,
  available,
}: {
  requestId: string;
  spotsRequested: number;
  available: number;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision>("approve");
  const [spots, setSpots] = useState(String(Math.min(spotsRequested, Math.max(available, 0))));
  const [state, formAction, pending] = useActionState(reviewRequestAction.bind(null, requestId), initial);

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Saved.");
      router.refresh();
    }
  }, [state, router]);

  const granted = Number(spots) || 0;
  const partial = decision === "approve" && granted > 0 && granted < spotsRequested;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="decision" value={decision} />
      <FormMessage state={state.ok ? undefined : state} />

      <div className="grid grid-cols-2 gap-2">
        {DECISIONS.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setDecision(d.key)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
              decision === d.key
                ? d.key === "reject"
                  ? "border-destructive/60 bg-destructive/10 text-white"
                  : "border-primary/60 bg-primary/10 text-white shadow-glow-red"
                : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-white"
            )}
          >
            <d.icon className="h-4 w-4" />
            {d.label}
          </button>
        ))}
      </div>

      {decision === "approve" && (
        <div>
          <Label htmlFor="spotsGranted">Spots to grant</Label>
          <Input
            id="spotsGranted"
            name="spotsGranted"
            type="number"
            min={1}
            max={Math.max(1, available)}
            value={spots}
            onChange={(e) => setSpots(e.target.value)}
            required
          />
          <p className={cn("mt-1 text-xs", partial ? "text-amber-300" : "text-muted-foreground")}>
            {available <= 0
              ? "No partner spots available — free some up or grow the listing first."
              : partial
                ? `Partial approval: ${granted} of ${spotsRequested} requested.`
                : `${available} available · they asked for ${spotsRequested}.`}
          </p>
          <FieldError errors={state.fieldErrors?.spotsGranted} />
        </div>
      )}

      <div>
        <Label htmlFor="note">
          {decision === "needs_info" ? "What do you need from them?" : "Note to the requester (optional)"}
        </Label>
        <Textarea
          id="note"
          name="note"
          rows={3}
          maxLength={2000}
          required={decision === "needs_info"}
          placeholder={
            decision === "approve"
              ? "Delivery deadline, wallet format, mint instructions…"
              : decision === "needs_info"
                ? "e.g. Share a Dune dashboard for your holder count."
                : "Optional context."
          }
        />
        <FieldError errors={state.fieldErrors?.note} />
      </div>

      <Button
        type="submit"
        className="w-full"
        variant={decision === "reject" ? "destructive" : "default"}
        disabled={pending || (decision === "approve" && available <= 0)}
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {decision === "approve"
          ? `Approve ${granted || ""} spot${granted === 1 ? "" : "s"}`
          : decision === "reject"
            ? "Reject request"
            : decision === "needs_info"
              ? "Ask for info"
              : "Move to waitlist"}
      </Button>
    </form>
  );
}

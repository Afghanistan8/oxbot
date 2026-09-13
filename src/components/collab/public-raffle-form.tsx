"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Dice5, Loader2, Rocket, Save, Zap } from "lucide-react";

import { openPublicRaffleAction } from "@/server/actions/collab";
import type { ActionState } from "@/server/actions/_result";
import { FCFS_SENTINEL_END_AT } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormMessage } from "@/components/dashboard/form-message";
import {
  RequirementBuilder,
  emptyDraft,
  serializeRequirements,
  type ReqDraft,
} from "@/components/dashboard/requirement-builder";

/**
 * PublicRaffleForm — open a listing's public slice as a raffle. Format +
 * schedule + entry tasks (the standard requirement builder, including the NFT
 * hold and token balance tasks), prefilled with "follow the project" and
 * "hold the collection" when the listing has what those need.
 */

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const toIso = (v: string) => {
  const d = new Date(v);
  return v && !Number.isNaN(d.getTime()) ? d.toISOString() : "";
};

const initial: ActionState<{ giveawayId: string; teamSlug: string }> = { ok: false };

export function PublicRaffleForm({
  listingId,
  publicSpots,
  defaults,
  discordServerId,
}: {
  listingId: string;
  publicSpots: number;
  defaults: {
    startAt: Date;
    endAt: Date;
    xHandle: string | null;
    holding: { type: "NFT_HOLD" | "TOKEN_BALANCE"; chain: string; contractAddress: string; label: string } | null;
  };
  discordServerId: string;
}) {
  const [state, formAction] = useActionState(openPublicRaffleAction.bind(null, listingId), initial);
  const [type, setType] = useState<"RANDOM" | "FCFS">("RANDOM");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [requirements, setRequirements] = useState<ReqDraft[]>(() => {
    const drafts: ReqDraft[] = [];
    if (defaults.xHandle) drafts.push({ ...emptyDraft("TWITTER_FOLLOW"), handle: defaults.xHandle });
    if (defaults.holding) {
      drafts.push({
        ...emptyDraft(defaults.holding.type),
        chain: defaults.holding.chain as ReqDraft["chain"],
        contractAddress: defaults.holding.contractAddress,
        label: defaults.holding.label,
        minBalance: defaults.holding.type === "TOKEN_BALANCE" ? "1" : "",
      });
    }
    return drafts;
  });

  // Client-only defaults (local timezone) — mirrors GiveawayForm.
  useEffect(() => {
    const now = Date.now();
    const start = new Date(Math.max(now, new Date(defaults.startAt).getTime()));
    const end = new Date(Math.max(start.getTime() + 24 * 60 * 60 * 1000, new Date(defaults.endAt).getTime()));
    setStartAt(toLocalInputValue(start));
    setEndAt(toLocalInputValue(end));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reqError = Object.keys(state.fieldErrors ?? {}).some((k) => k.startsWith("requirements"));

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="startAt" value={toIso(startAt)} />
      <input type="hidden" name="endAt" value={type === "FCFS" ? FCFS_SENTINEL_END_AT.toISOString() : toIso(endAt)} />
      <input type="hidden" name="requirements" value={JSON.stringify(serializeRequirements(requirements))} />

      <FormMessage state={state} />

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            { key: "RANDOM", icon: Dice5, label: "Random raffle", blurb: `${publicSpots} winners drawn with a seeded CSPRNG at the end.` },
            { key: "FCFS", icon: Zap, label: "First come, first served", blurb: `The first ${publicSpots} entrants to finish every task win.` },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setType(opt.key)}
            className={cn(
              "rounded-2xl border p-4 text-left transition-all",
              type === opt.key ? "border-primary/60 bg-primary/10 shadow-glow-red" : "border-border bg-card/40 hover:border-primary/40"
            )}
          >
            <opt.icon className={cn("mb-2 h-5 w-5", type === opt.key ? "text-primary" : "text-muted-foreground")} />
            <p className="text-sm font-semibold text-white">{opt.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{opt.blurb}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`raffle-start-${listingId}`}>Entry opens</Label>
          <Input id={`raffle-start-${listingId}`} type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
          <FieldError errors={state.fieldErrors?.startAt} />
        </div>
        {type === "RANDOM" ? (
          <div>
            <Label htmlFor={`raffle-end-${listingId}`}>Entry closes</Label>
            <Input id={`raffle-end-${listingId}`} type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required />
            <FieldError errors={state.fieldErrors?.endAt} />
          </div>
        ) : (
          <p className="self-end rounded-xl border border-border bg-ink-black/40 px-4 py-3 text-xs text-muted-foreground">
            Closes the moment all {publicSpots} spots are claimed.
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-white">Entry tasks</p>
        {reqError && (
          <p className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            One or more tasks are missing details.
          </p>
        )}
        <RequirementBuilder value={requirements} onChange={setRequirements} discordServerId={discordServerId} />
      </div>

      <Actions />
    </form>
  );
}

function Actions() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button type="submit" name="publish" value="false" variant="outline" disabled={pending}>
        <Save className="h-4 w-4" />
        Save as draft
      </Button>
      <Button type="submit" name="publish" value="true" variant="gold" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
        {pending ? "Opening…" : "Open raffle"}
      </Button>
    </div>
  );
}

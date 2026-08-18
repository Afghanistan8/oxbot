"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Dice5,
  Zap,
  KeyRound,
  Loader2,
  Save,
  Rocket,
  Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Blockchain, GiveawayType, GiveawayVisibility } from "@prisma/client";

import { createGiveawayAction, updateGiveawayAction } from "@/server/actions/giveaway";
import { FCFS_SENTINEL_END_AT } from "@/lib/format";
import type { ActionState } from "@/server/actions/_result";
import type { ManagedGiveaway } from "@/server/queries/dashboard";
import {
  ALL_CHAINS,
  CHAIN_META,
  GIVEAWAY_TYPE_META,
  GIVEAWAY_VISIBILITY_META,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormMessage, FieldError } from "@/components/dashboard/form-message";
import { ImageUploadField } from "@/components/dashboard/image-upload-field";
import {
  RequirementBuilder,
  serializeRequirements,
  draftsFromRequirements,
  type ReqDraft,
} from "@/components/dashboard/requirement-builder";

const initial: ActionState<{ slug: string; teamSlug: string; id: string }> = { ok: false };

const TYPE_ICONS: Record<GiveawayType, LucideIcon> = {
  RANDOM: Dice5,
  FCFS: Zap,
  CODE: KeyRound,
};

const GIVEAWAY_TYPES: GiveawayType[] = ["RANDOM", "FCFS", "CODE"];

/** Format a Date as a `datetime-local` input value in the viewer's local time. */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/**
 * Convert a `datetime-local` value (a bare wall-clock string with no timezone,
 * e.g. "2026-08-17T23:19") into an absolute UTC ISO instant.
 *
 * The browser parses that string in the *viewer's* local timezone, so this
 * captures the exact moment the user picked. Without it the raw string was
 * posted and re-parsed on the server in the server's timezone (UTC on Vercel),
 * which shoved every schedule off by the viewer's UTC offset — a "start now"
 * from a UTC+1 user landed an hour in the future, leaving the giveaway stuck
 * as "upcoming" instead of going live.
 */
function localInputToIso(v: string): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function GiveawayForm({
  mode,
  teamId,
  giveaway,
  defaultChain = "ETHEREUM",
}: {
  mode: "create" | "edit";
  teamId: string;
  giveaway?: ManagedGiveaway;
  defaultChain?: Blockchain;
}) {
  // A single action closure keeps useActionState's state type stable across
  // create/edit (edit never returns `data`, so we drop it into the shared shape).
  type FormResult = ActionState<{ slug: string; teamSlug: string; id: string }>;
  const [state, formAction] = useActionState<FormResult, FormData>(
    async (prev, formData) => {
      if (mode === "create") return createGiveawayAction(teamId, prev, formData);
      const res = await updateGiveawayAction(giveaway!.id, prev, formData);
      return { ok: res.ok, error: res.error, fieldErrors: res.fieldErrors, message: res.message };
    },
    initial
  );

  // Controlled non-native fields (Radix selects + switches don't post natively).
  const [type, setType] = useState<GiveawayType>(giveaway?.type ?? "RANDOM");
  const [chain, setChain] = useState<Blockchain>(giveaway?.chain ?? defaultChain);
  const [visibility, setVisibility] = useState<GiveawayVisibility>(
    giveaway?.visibility ?? "PUBLIC"
  );
  const [hideEntryCount, setHideEntryCount] = useState(giveaway?.hideEntryCount ?? false);
  const [requirements, setRequirements] = useState<ReqDraft[]>(
    giveaway ? draftsFromRequirements(giveaway.requirements) : []
  );

  // Dates: for create, default to now → +7d on mount (client-only, avoids SSR
  // hydration mismatch); for edit, seed from the stored values (stable).
  const [startAt, setStartAt] = useState(
    giveaway ? toLocalInputValue(giveaway.startAt) : ""
  );
  const [endAt, setEndAt] = useState(giveaway ? toLocalInputValue(giveaway.endAt) : "");
  const [discordServerId, setDiscordServerId] = useState(giveaway?.discordServerId ?? "");
  useEffect(() => {
    if (mode === "create") {
      const now = new Date();
      setStartAt(toLocalInputValue(now));
      setEndAt(toLocalInputValue(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const typeLocked = mode === "edit";
  const entriesLocked = mode === "edit" && (giveaway?.entryCount ?? 0) > 0;
  const requirementsJson = JSON.stringify(serializeRequirements(requirements));
  const hasReqFieldError = Object.keys(state.fieldErrors ?? {}).some((k) =>
    k.startsWith("requirements")
  );

  return (
    <form action={formAction} className="space-y-6">
      {/* Non-native field values carried as hidden inputs. */}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="chain" value={chain} />
      <input type="hidden" name="visibility" value={visibility} />
      <input type="hidden" name="hideEntryCount" value={hideEntryCount ? "true" : "false"} />
      <input type="hidden" name="requirements" value={requirementsJson} />
      {/* Schedule posts as absolute UTC instants (see localInputToIso) — the
          visible datetime-local fields below carry no name so only these do.
          FCFS has no author end time, so it posts the far-future sentinel. */}
      <input type="hidden" name="startAt" value={localInputToIso(startAt)} />
      <input
        type="hidden"
        name="endAt"
        value={type === "FCFS" ? FCFS_SENTINEL_END_AT.toISOString() : localInputToIso(endAt)}
      />

      <FormMessage state={state} />

      {/* --- Basics --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basics</CardTitle>
          <CardDescription>What are you giving away?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={giveaway?.title ?? ""}
              placeholder="e.g. Genesis Pass Whitelist"
              maxLength={120}
              required
            />
            <FieldError errors={state.fieldErrors?.title} />
          </div>
          <div>
            <Label htmlFor="prize">Prize</Label>
            <Input
              id="prize"
              name="prize"
              defaultValue={giveaway?.prize ?? ""}
              placeholder="e.g. 3× WL spots + 0.5 ETH"
              maxLength={500}
              required
            />
            <FieldError errors={state.fieldErrors?.prize} />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={giveaway?.description ?? ""}
              rows={4}
              maxLength={4000}
              placeholder="Add details, rules, and anything entrants should know."
            />
            <FieldError errors={state.fieldErrors?.description} />
          </div>
          <div>
            <ImageUploadField
              name="bannerUrl"
              label="Banner image"
              folder="banners"
              aspect="wide"
              defaultValue={giveaway?.bannerUrl}
            />
            <FieldError errors={state.fieldErrors?.bannerUrl} />
          </div>
        </CardContent>
      </Card>

      {/* --- Format --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Format</CardTitle>
          <CardDescription>
            {typeLocked
              ? "The giveaway type can't be changed after creation."
              : "How are winners chosen?"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {GIVEAWAY_TYPES.map((t) => {
              const meta = GIVEAWAY_TYPE_META[t];
              const Icon = TYPE_ICONS[t];
              const active = type === t;
              const isDisabled = typeLocked && !active;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={typeLocked}
                  onClick={() => !typeLocked && setType(t)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-all",
                    active
                      ? "border-primary/60 bg-primary/10 shadow-glow-red"
                      : "border-border bg-card/40 hover:border-primary/40",
                    isDisabled && "opacity-40",
                    typeLocked && "cursor-default"
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-lg",
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {typeLocked && active && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <p className="text-sm font-semibold text-white">{meta.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{meta.blurb}</p>
                </button>
              );
            })}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="winnersCount">
                {type === "FCFS" ? "Number of slots" : "Number of winners"}
              </Label>
              <Input
                id="winnersCount"
                name="winnersCount"
                type="number"
                min={1}
                max={10000}
                defaultValue={giveaway?.winnersCount ?? 1}
                required
              />
              <FieldError errors={state.fieldErrors?.winnersCount} />
            </div>
          </div>

          {/* Code generation — CODE giveaways only, and only when creating. */}
          {type === "CODE" && mode === "create" && (
            <div className="rounded-2xl border border-border bg-ink-black/40 p-4">
              <p className="text-sm font-medium text-white">Generate entry codes</p>
              <p className="mb-4 text-xs text-muted-foreground">
                Optionally pre-generate codes now. You can also add more later.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="generateCodes">How many</Label>
                  <Input
                    id="generateCodes"
                    name="generateCodes"
                    type="number"
                    min={0}
                    max={5000}
                    defaultValue={0}
                  />
                  <FieldError errors={state.fieldErrors?.generateCodes} />
                </div>
                <div>
                  <Label htmlFor="codePrefix">Prefix (optional)</Label>
                  <Input
                    id="codePrefix"
                    name="codePrefix"
                    placeholder="OX"
                    maxLength={12}
                  />
                  <FieldError errors={state.fieldErrors?.codePrefix} />
                </div>
                <div>
                  <Label htmlFor="codeMaxUses">Uses per code</Label>
                  <Input
                    id="codeMaxUses"
                    name="codeMaxUses"
                    type="number"
                    min={1}
                    defaultValue={1}
                  />
                  <FieldError errors={state.fieldErrors?.codeMaxUses} />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Schedule --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schedule</CardTitle>
          <CardDescription>
            {type === "FCFS"
              ? "Set when entry opens — it closes automatically once every slot is claimed."
              : "Times use your local timezone."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="startAt">Starts</Label>
            <Input
              id="startAt"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
            />
            <FieldError errors={state.fieldErrors?.startAt} />
          </div>
          {type === "FCFS" ? (
            <div className="flex items-end">
              <p className="rounded-xl border border-border bg-ink-black/40 px-4 py-3 text-xs text-muted-foreground">
                <span className="font-medium text-scarlet-soft">First come, first served.</span>{" "}
                No end time — entry closes the moment all slots are claimed.
              </p>
            </div>
          ) : (
            <div>
              <Label htmlFor="endAt">Ends</Label>
              <Input
                id="endAt"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                required
              />
              <FieldError errors={state.fieldErrors?.endAt} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Visibility & chain --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visibility &amp; network</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>Chain</Label>
              <Select value={chain} onValueChange={(v) => setChain(v as Blockchain)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_CHAINS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CHAIN_META[c].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(v) => setVisibility(v as GiveawayVisibility)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(GIVEAWAY_VISIBILITY_META) as GiveawayVisibility[]).map((v) => (
                    <SelectItem key={v} value={v}>
                      {GIVEAWAY_VISIBILITY_META[v].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {GIVEAWAY_VISIBILITY_META[visibility].blurb}
              </p>
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card/40 p-4">
            <div>
              <p className="text-sm font-medium text-white">Hide entry count</p>
              <p className="text-xs text-muted-foreground">
                Keep the number of entrants private on the public page.
              </p>
            </div>
            <Switch
              checked={hideEntryCount}
              onCheckedChange={setHideEntryCount}
              aria-label="Hide entry count"
            />
          </div>
        </CardContent>
      </Card>

      {/* --- Requirements --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entry requirements</CardTitle>
          <CardDescription>
            {entriesLocked
              ? "Entries already exist — requirements are locked to keep the draw fair."
              : "Tasks participants must complete to enter."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasReqFieldError && (
            <p className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              One or more requirements are missing details. Please review below.
            </p>
          )}
          <RequirementBuilder
            value={requirements}
            onChange={setRequirements}
            disabled={entriesLocked}
            discordServerId={discordServerId}
          />
        </CardContent>
      </Card>

      {/* --- Social context --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project links</CardTitle>
          <CardDescription>
            Shown to participants on the giveaway page.{" "}
            {visibility === "PRIVATE"
              ? "Optional for private, code-gated giveaways."
              : "A Discord server ID is required for public and community giveaways."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-3">
          <div>
            <Label htmlFor="xAccount">X account</Label>
            <Input
              id="xAccount"
              name="xAccount"
              defaultValue={giveaway?.xAccount ?? ""}
              placeholder="yourproject"
            />
            <FieldError errors={state.fieldErrors?.xAccount} />
          </div>
          <div>
            <Label htmlFor="discordServerId">
              Discord server ID
              {visibility !== "PRIVATE" && <span className="ml-1 text-primary">*</span>}
            </Label>
            <Input
              id="discordServerId"
              name="discordServerId"
              value={discordServerId}
              onChange={(e) => setDiscordServerId(e.target.value)}
              placeholder="123456789012345678"
              required={visibility !== "PRIVATE"}
            />
            <FieldError errors={state.fieldErrors?.discordServerId} />
          </div>
          <div>
            <Label htmlFor="telegram">Telegram</Label>
            <Input
              id="telegram"
              name="telegram"
              defaultValue={giveaway?.telegram ?? ""}
              placeholder="t.me/…"
            />
            <FieldError errors={state.fieldErrors?.telegram} />
          </div>
        </CardContent>
      </Card>

      <FormActions mode={mode} />
    </form>
  );
}

/**
 * Submit controls. Uses `useFormStatus` (must be inside the form) so buttons
 * disable while the action runs. Create mode offers draft + publish; the clicked
 * button's `name=publish` value is what the server reads.
 */
function FormActions({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();

  if (mode === "edit") {
    return (
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button type="submit" name="publish" value="false" variant="outline" disabled={pending}>
        <Save className="h-4 w-4" />
        Save as draft
      </Button>
      <Button type="submit" name="publish" value="true" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
        {pending ? "Working…" : "Publish giveaway"}
      </Button>
    </div>
  );
}

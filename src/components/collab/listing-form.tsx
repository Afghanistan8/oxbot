"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2, Lock, Rocket, Save, Zap, ListChecks, Dices, Hand } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AssetType, Blockchain, DistributionMethod, GiveawayVisibility } from "@prisma/client";

import { createListingAction, updateListingAction } from "@/server/actions/collab";
import type { ActionState } from "@/server/actions/_result";
import type { ManagedListing, CriteriaTemplate } from "@/server/queries/collab";
import { ALL_CHAINS, CHAIN_META, GIVEAWAY_VISIBILITY_META } from "@/lib/constants";
import { ASSET_TYPES, ASSET_TYPE_META, DISTRIBUTION_METHODS, METHOD_META } from "@/lib/collab/constants";
import { cn, formatNumber } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FormMessage, FieldError } from "@/components/dashboard/form-message";
import { ImageUploadField } from "@/components/dashboard/image-upload-field";
import { ChainBadge } from "@/components/giveaway/chain-badge";
import {
  CriteriaEditor,
  draftFromCriteria,
  serializeCriteria,
  type CriteriaDraft,
} from "@/components/collab/criteria-editor";

/**
 * ListingForm — create / edit a Collab whitelist listing. Mirrors GiveawayForm:
 * card sections, controlled Radix-free inputs carried in hidden fields, and
 * schedule values posted as absolute UTC instants.
 *
 * Sections: identity → spots → distribution → criteria → window → visibility.
 */

export type ListingTeamProfile = {
  name: string;
  logoUrl: string | null;
  slug: string;
  primaryChain: Blockchain | null;
  chains: Blockchain[];
  totalSupply: string | null;
  mintPrice: string | null;
  mintAt: Date | null;
  xHandle: string | null;
  discordInvite: string | null;
};

const METHOD_ICONS: Record<DistributionMethod, LucideIcon> = {
  FCFS: Zap,
  CRITERIA: ListChecks,
  RAFFLE: Dices,
  MANUAL: Hand,
};

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local wall-clock → absolute UTC ISO (see GiveawayForm for the why). */
function localInputToIso(v: string): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

type FormResult = ActionState<{ id: string; teamSlug: string }>;
const initial: FormResult = { ok: false };

export function ListingForm({
  mode,
  teamId,
  team,
  listing,
  templates,
}: {
  mode: "create" | "edit";
  teamId: string;
  team: ListingTeamProfile;
  listing?: ManagedListing;
  templates: CriteriaTemplate[];
}) {
  const [state, formAction] = useActionState<FormResult, FormData>(async (prev, formData) => {
    if (mode === "create") return createListingAction(teamId, prev, formData);
    const res = await updateListingAction(listing!.id, prev, formData);
    return { ok: res.ok, error: res.error, fieldErrors: res.fieldErrors, message: res.message };
  }, initial);

  const [assetType, setAssetType] = useState<AssetType>(listing?.assetType ?? "NFT");
  const [chain, setChain] = useState<Blockchain>(listing?.chain ?? team.primaryChain ?? team.chains[0] ?? "ETHEREUM");
  const [method, setMethod] = useState<DistributionMethod>(listing?.distributionMethod ?? "CRITERIA");
  const [visibility, setVisibility] = useState<GiveawayVisibility>(listing?.visibility ?? "PUBLIC");
  const [hideRequestCount, setHideRequestCount] = useState(listing?.hideRequestCount ?? false);
  const [criteria, setCriteria] = useState<CriteriaDraft>(draftFromCriteria(listing?.criteria));

  const [totalSpots, setTotalSpots] = useState(String(listing?.totalSpots ?? 100));
  const [publicSpots, setPublicSpots] = useState(String(listing?.publicSpots ?? 0));
  const [minPer, setMinPer] = useState(String(listing?.spotsPerRequestMin ?? 1));
  const [maxPer, setMaxPer] = useState(String(listing?.spotsPerRequestMax ?? 25));

  const [startAt, setStartAt] = useState(listing ? toLocalInputValue(listing.startAt) : "");
  const [endAt, setEndAt] = useState(listing ? toLocalInputValue(listing.endAt) : "");
  const [mintOrTgeAt, setMintOrTgeAt] = useState(
    listing?.mintOrTgeAt ? toLocalInputValue(listing.mintOrTgeAt) : ""
  );
  useEffect(() => {
    if (mode !== "create") return;
    const now = new Date();
    setStartAt(toLocalInputValue(now));
    setEndAt(toLocalInputValue(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)));
    if (team.mintAt) setMintOrTgeAt(toLocalInputValue(new Date(team.mintAt)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const methodLocked = mode === "edit" && (listing?.requestCount ?? 0) > 0;
  const committed = (listing?.reservedSpots ?? 0) + (listing?.allocatedSpots ?? 0);
  const partnerInventory = useMemo(() => {
    const t = Number(totalSpots) || 0;
    const p = Number(publicSpots) || 0;
    return Math.max(0, t - p - committed);
  }, [totalSpots, publicSpots, committed]);
  const isToken = assetType === "TOKEN";

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="assetType" value={assetType} />
      <input type="hidden" name="chain" value={chain} />
      <input type="hidden" name="distributionMethod" value={method} />
      <input type="hidden" name="visibility" value={visibility} />
      <input type="hidden" name="hideRequestCount" value={hideRequestCount ? "true" : "false"} />
      <input type="hidden" name="criteria" value={serializeCriteria(criteria)} />
      <input type="hidden" name="startAt" value={localInputToIso(startAt)} />
      <input type="hidden" name="endAt" value={localInputToIso(endAt)} />
      <input type="hidden" name="mintOrTgeAt" value={localInputToIso(mintOrTgeAt)} />

      <FormMessage state={state} />

      {/* --- 1. Identity --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project &amp; asset</CardTitle>
          <CardDescription>What are partners getting whitelisted for?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-ink-black/40 p-4">
            <Avatar className="h-10 w-10 rounded-xl">
              {team.logoUrl && <AvatarImage src={team.logoUrl} alt="" className="rounded-xl" />}
              <AvatarFallback className="rounded-xl">{team.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{team.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[
                  team.totalSupply && `Supply ${team.totalSupply}`,
                  team.mintPrice && `Mint ${team.mintPrice}`,
                  team.xHandle && `@${team.xHandle}`,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Pulled from your project profile"}
              </p>
            </div>
            {team.primaryChain && <ChainBadge chain={team.primaryChain} />}
            <Link href={`/dashboard/${team.slug}/settings`} className="text-xs text-scarlet-soft hover:text-white">
              Edit profile
            </Link>
          </div>

          <div>
            <Label htmlFor="title">Listing title</Label>
            <Input
              id="title"
              name="title"
              defaultValue={listing?.title ?? `${team.name} — GTD Whitelist`}
              maxLength={120}
              required
            />
            <FieldError errors={state.fieldErrors?.title} />
          </div>
          <div>
            <Label htmlFor="description">What partners should know</Label>
            <Textarea
              id="description"
              name="description"
              rows={4}
              maxLength={4000}
              defaultValue={listing?.description ?? ""}
              placeholder="Who you want to partner with, what the spots are (GTD / FCFS), mint details, delivery expectations."
            />
            <FieldError errors={state.fieldErrors?.description} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>Asset type</Label>
              <div className="grid grid-cols-3 gap-2">
                {ASSET_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAssetType(t)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                      assetType === t
                        ? "border-primary/60 bg-primary/10 text-white shadow-glow-red"
                        : "border-border bg-card/40 text-muted-foreground hover:border-primary/40"
                    )}
                  >
                    {ASSET_TYPE_META[t].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="chain">Chain</Label>
              <select
                id="chain"
                value={chain}
                onChange={(e) => setChain(e.target.value as Blockchain)}
                className="flex h-10 w-full rounded-xl border border-input bg-ink-charcoal/60 px-3 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ALL_CHAINS.map((c) => (
                  <option key={c} value={c}>
                    {CHAIN_META[c].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {isToken ? (
              <>
                <div>
                  <Label htmlFor="tokenSymbol">Token symbol</Label>
                  <Input id="tokenSymbol" name="tokenSymbol" defaultValue={listing?.tokenSymbol ?? ""} placeholder="LAVA" maxLength={20} />
                  <FieldError errors={state.fieldErrors?.tokenSymbol} />
                </div>
                <div>
                  <Label htmlFor="tokenAddress">Token address (optional)</Label>
                  <Input id="tokenAddress" name="tokenAddress" defaultValue={listing?.tokenAddress ?? ""} placeholder="0x… / mint" className="font-mono" maxLength={120} />
                  <FieldError errors={state.fieldErrors?.tokenAddress} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="collectionName">Collection name</Label>
                  <Input id="collectionName" name="collectionName" defaultValue={listing?.collectionName ?? team.name} maxLength={120} />
                  <FieldError errors={state.fieldErrors?.collectionName} />
                </div>
                <div>
                  <Label htmlFor="collectionAddress">Contract address (optional)</Label>
                  <Input id="collectionAddress" name="collectionAddress" defaultValue={listing?.collectionAddress ?? ""} placeholder="0x… / collection id" className="font-mono" maxLength={120} />
                  <FieldError errors={state.fieldErrors?.collectionAddress} />
                </div>
              </>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="mintOrTgeAtInput">{isToken ? "TGE date (optional)" : "Mint date (optional)"}</Label>
              <Input id="mintOrTgeAtInput" type="datetime-local" value={mintOrTgeAt} onChange={(e) => setMintOrTgeAt(e.target.value)} />
              <FieldError errors={state.fieldErrors?.mintOrTgeAt} />
            </div>
          </div>

          <div>
            <ImageUploadField name="bannerUrl" label="Banner image" folder="banners" aspect="wide" defaultValue={listing?.bannerUrl} />
            <FieldError errors={state.fieldErrors?.bannerUrl} />
          </div>
        </CardContent>
      </Card>

      {/* --- 2. Spots --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spots</CardTitle>
          <CardDescription>
            Total inventory, how much each partner may ask for, and an optional slice for a public raffle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField id="totalSpots" label="Total spots" value={totalSpots} onChange={setTotalSpots} min={1} error={state.fieldErrors?.totalSpots} />
            <NumberField id="publicSpots" label="Public raffle slice" value={publicSpots} onChange={setPublicSpots} min={0} error={state.fieldErrors?.publicSpots} />
            <NumberField id="spotsPerRequestMin" label="Min per partner" value={minPer} onChange={setMinPer} min={1} error={state.fieldErrors?.spotsPerRequestMin} />
            <NumberField id="spotsPerRequestMax" label="Max per partner" value={maxPer} onChange={setMaxPer} min={1} error={state.fieldErrors?.spotsPerRequestMax} />
          </div>
          <p className="rounded-xl border border-border bg-ink-black/40 px-4 py-3 text-xs text-muted-foreground">
            <span className="font-medium text-scarlet-soft">{formatNumber(partnerInventory)}</span> spots open to partners
            {committed > 0 && <> · {formatNumber(committed)} already granted</>}
            {Number(publicSpots) > 0 && <> · {formatNumber(Number(publicSpots))} held for a public raffle (open it from the listing page once published)</>}
          </p>
        </CardContent>
      </Card>

      {/* --- 3. Distribution --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribution</CardTitle>
          <CardDescription>
            {methodLocked ? "Locked — requests have already been filed under this method." : "How partner spots are handed out."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {DISTRIBUTION_METHODS.map((m) => {
              const Icon = METHOD_ICONS[m];
              const active = method === m;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={methodLocked}
                  onClick={() => setMethod(m)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-all",
                    active ? "border-primary/60 bg-primary/10 shadow-glow-red" : "border-border bg-card/40 hover:border-primary/40",
                    methodLocked && !active && "opacity-40",
                    methodLocked && "cursor-default"
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div className={cn("grid h-8 w-8 place-items-center rounded-lg", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {methodLocked && active && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <p className="text-sm font-semibold text-white">{METHOD_META[m].label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{METHOD_META[m].blurb}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* --- 4. Criteria --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Criteria</CardTitle>
          <CardDescription>
            {method === "MANUAL"
              ? "Optional — every request comes to you, criteria just score them."
              : method === "FCFS"
                ? "Requests that meet these are approved instantly while spots last."
                : method === "RAFFLE"
                  ? "Only requesters that meet these enter the partner raffle."
                  : "Qualified requests go to your review queue; the rest are flagged."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CriteriaEditor value={criteria} onChange={setCriteria} templates={templates} />
          <FieldError errors={Object.entries(state.fieldErrors ?? {}).find(([k]) => k.startsWith("criteria"))?.[1]} />
        </CardContent>
      </Card>

      {/* --- 5. Window --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Request window</CardTitle>
          <CardDescription>Times use your local timezone.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="startAtInput">Opens</Label>
            <Input id="startAtInput" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
            <FieldError errors={state.fieldErrors?.startAt} />
          </div>
          <div>
            <Label htmlFor="endAtInput">Closes</Label>
            <Input id="endAtInput" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required />
            <FieldError errors={state.fieldErrors?.endAt} />
          </div>
        </CardContent>
      </Card>

      {/* --- 6. Visibility & privacy --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visibility &amp; privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="visibilitySelect">Visibility</Label>
              <select
                id="visibilitySelect"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as GiveawayVisibility)}
                className="flex h-10 w-full rounded-xl border border-input bg-ink-charcoal/60 px-3 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {(Object.keys(GIVEAWAY_VISIBILITY_META) as GiveawayVisibility[]).map((v) => (
                  <option key={v} value={v}>
                    {GIVEAWAY_VISIBILITY_META[v].label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                {visibility === "PRIVATE" ? "Hidden from browse — share the link directly with partners." : "Listed on the Collab desk."}
              </p>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card/40 p-4">
              <div>
                <p className="text-sm font-medium text-white">Hide request count</p>
                <p className="text-xs text-muted-foreground">Don&apos;t show how many teams have applied.</p>
              </div>
              <Switch checked={hideRequestCount} onCheckedChange={setHideRequestCount} aria-label="Hide request count" />
            </div>
          </div>
          <div>
            <Label htmlFor="notesPrivate">Private notes</Label>
            <Textarea
              id="notesPrivate"
              name="notesPrivate"
              rows={3}
              maxLength={4000}
              defaultValue={listing?.notesPrivate ?? ""}
              placeholder="Only your team sees this — partner priorities, delivery deadlines, contacts."
            />
          </div>
        </CardContent>
      </Card>

      <FormActions mode={mode} />
    </form>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  error?: string[];
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type="number" min={min} max={100000} value={value} onChange={(e) => onChange(e.target.value)} required />
      <FieldError errors={error} />
    </div>
  );
}

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
        {pending ? "Working…" : "Publish listing"}
      </Button>
    </div>
  );
}

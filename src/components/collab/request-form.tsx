"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Hourglass, Loader2, Plus, Send, Trash2, Zap } from "lucide-react";
import type { AssetType, Blockchain } from "@prisma/client";

import { submitRequestAction, type SubmitRequestResult } from "@/server/actions/collab";
import type { ActionState } from "@/server/actions/_result";
import type { RequesterTeamOption } from "@/server/queries/collab-public";
import { evaluateEligibility, type CriteriaInput } from "@/lib/collab/eligibility";
import { ASSET_TYPES, ASSET_TYPE_META, REQUEST_STATUS_META } from "@/lib/collab/constants";
import { ALL_CHAINS, CHAIN_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FieldError, FormMessage } from "@/components/dashboard/form-message";
import { EligibilityMeter } from "@/components/collab/eligibility-meter";

/**
 * RequestForm — a project requests spots on a listing. The eligibility meter
 * re-scores on every keystroke with the same engine the server uses, so the
 * requester knows exactly where they stand before submitting.
 */

type Result = ActionState<SubmitRequestResult>;
const initial: Result = { ok: false };

const toNum = (v: string) => {
  const n = Number(v.replace(/[,\s]/g, ""));
  return v.trim() === "" || !Number.isFinite(n) ? null : Math.floor(n);
};

export function RequestForm({
  listing,
  teams,
  criteria,
  dashboardBase,
  listingHref,
  blockedReason,
}: {
  listing: {
    id: string;
    title: string;
    teamName: string;
    chain: Blockchain;
    spotsPerRequestMin: number;
    spotsPerRequestMax: number;
    available: number;
    distributionMethod: string;
  };
  teams: RequesterTeamOption[];
  criteria: CriteriaInput | null;
  /** "" on the main host; the main host's origin on the Collab host. */
  dashboardBase: string;
  listingHref: string;
  /** Why a new request can't be filed right now (null = form is open). */
  blockedReason: string | null;
}) {
  const action = useMemo(() => submitRequestAction.bind(null, listing.id), [listing.id]);
  const [state, formAction, pending] = useActionState(action, initial);

  const selectable = teams.filter((t) => !t.hasActiveRequest);
  const [teamId, setTeamId] = useState(selectable[0]?.id ?? "");
  const team = teams.find((t) => t.id === teamId) ?? null;
  const cap = Math.min(listing.spotsPerRequestMax, Math.max(listing.spotsPerRequestMin, listing.available));

  const [spots, setSpots] = useState(String(Math.min(cap, Math.max(listing.spotsPerRequestMin, 10))));
  const [communitySize, setCommunitySize] = useState("");
  const [holderCount, setHolderCount] = useState("");
  const [twitterFollowers, setTwitterFollowers] = useState("");
  const [discordMembers, setDiscordMembers] = useState("");
  const [chains, setChains] = useState<Blockchain[]>(team?.chains ?? []);
  const [assetType, setAssetType] = useState<AssetType | "">("");
  const [links, setLinks] = useState<string[]>([""]);
  const [attested, setAttested] = useState<Set<string>>(new Set());

  function pickTeam(id: string) {
    setTeamId(id);
    setChains(teams.find((t) => t.id === id)?.chains ?? []);
  }

  const eligibility = useMemo(
    () =>
      evaluateEligibility(criteria, {
        communitySize: toNum(communitySize),
        holderCount: toNum(holderCount),
        twitterFollowers: toNum(twitterFollowers),
        discordMembers: toNum(discordMembers),
        raffleEntries: team?.raffleEntries ?? 0,
        chains,
        assetType: assetType || null,
        verifiedTeam: team?.verifiedTeam ?? false,
        attestations: Object.fromEntries([...attested].map((id) => [id, true])),
      }),
    [criteria, communitySize, holderCount, twitterFollowers, discordMembers, team, chains, assetType, attested]
  );

  if (state.ok && state.data) {
    return <SubmittedPanel result={state.data} message={state.message} dashboardBase={dashboardBase} listingHref={listingHref} />;
  }
  if (blockedReason) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card bg-card-glow p-8 text-center shadow-card">
        <p className="font-display text-xl font-semibold text-white">Nothing to request</p>
        <p className="mt-2 text-sm text-muted-foreground">{blockedReason}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href={listingHref}>Back to listing</Link>
        </Button>
      </div>
    );
  }

  const fe = state.fieldErrors ?? {};
  const outcomeHint =
    listing.distributionMethod === "FCFS"
      ? eligibility.eligible
        ? "You qualify — this is approved instantly if spots remain."
        : "Below criteria — it will be filed but flagged, and won't be auto-approved."
      : listing.distributionMethod === "RAFFLE"
        ? eligibility.eligible
          ? "You qualify — you'll be entered in the partner raffle when the window closes."
          : "Below criteria — you won't be entered in the partner raffle."
        : eligibility.eligible
          ? "You qualify — this goes straight to their review queue."
          : "Below criteria — you can still submit; it will be flagged for the reviewer.";

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0 space-y-6">
        <FormMessage state={state} />
        <input type="hidden" name="requesterTeamId" value={teamId} />
        <input type="hidden" name="requesterAssetType" value={assetType} />
        {chains.map((c) => (
          <input key={c} type="hidden" name="requesterChains" value={c} />
        ))}
        {[...attested].map((id) => (
          <input key={id} type="hidden" name="attestations" value={id} />
        ))}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requesting as</CardTitle>
            <CardDescription>Requests are filed on behalf of one of your projects.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={t.hasActiveRequest}
                onClick={() => pickTeam(t.id)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3 text-left transition-all",
                  teamId === t.id ? "border-primary/60 bg-primary/10 shadow-glow-red" : "border-border bg-card/40 hover:border-primary/40",
                  t.hasActiveRequest && "cursor-not-allowed opacity-50"
                )}
              >
                <Avatar className="h-9 w-9 rounded-xl">
                  {t.logoUrl && <AvatarImage src={t.logoUrl} alt="" className="rounded-xl" />}
                  <AvatarFallback className="rounded-xl">{t.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{t.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t.hasActiveRequest ? "Already requested" : t.verifiedTeam ? "Verified project" : `${t.raffleEntries} oxbot entries`}
                  </span>
                </span>
              </button>
            ))}
            <FieldError errors={fe.requesterTeamId} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your ask</CardTitle>
            <CardDescription>
              {listing.spotsPerRequestMin}–{listing.spotsPerRequestMax} spots per partner · {listing.available} available now
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="max-w-[12rem]">
              <Label htmlFor="spotsRequested">Spots requested</Label>
              <Input
                id="spotsRequested"
                name="spotsRequested"
                type="number"
                min={listing.spotsPerRequestMin}
                max={listing.spotsPerRequestMax}
                value={spots}
                onChange={(e) => setSpots(e.target.value)}
                required
              />
              <FieldError errors={fe.spotsRequested} />
            </div>
            <div>
              <Label htmlFor="pitch">Pitch</Label>
              <Textarea
                id="pitch"
                name="pitch"
                rows={5}
                maxLength={4000}
                required
                placeholder={`Why should ${listing.teamName} partner with you? Who gets the spots, and how will you distribute them?`}
              />
              <FieldError errors={fe.pitch} />
            </div>
            <div>
              <Label htmlFor="audienceSummary">Audience (optional)</Label>
              <Textarea
                id="audienceSummary"
                name="audienceSummary"
                rows={3}
                maxLength={2000}
                placeholder="Who your community is — regions, collectors vs traders, overlap with their audience."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your numbers</CardTitle>
            <CardDescription>Self-reported and shown to the reviewer as such. Back them up with links below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <StatInput id="communitySize" label="Community size" value={communitySize} onChange={setCommunitySize} error={fe.communitySize} />
              <StatInput id="twitterFollowers" label="X followers" value={twitterFollowers} onChange={setTwitterFollowers} error={fe.twitterFollowers} />
              <StatInput id="discordMembers" label="Discord members" value={discordMembers} onChange={setDiscordMembers} error={fe.discordMembers} />
              <StatInput id="holderCount" label="Holders" value={holderCount} onChange={setHolderCount} error={fe.holderCount} />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-white">Your chains</p>
              <div className="flex flex-wrap gap-2">
                {ALL_CHAINS.map((c) => {
                  const active = chains.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setChains(active ? chains.filter((x) => x !== c) : [...chains, c])}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        active ? "border-primary/60 bg-primary/15 text-white shadow-glow-red" : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-white"
                      )}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHAIN_META[c].color }} />
                      {CHAIN_META[c].label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="max-w-xs">
              <Label htmlFor="assetTypeSelect">Your project type</Label>
              <select
                id="assetTypeSelect"
                value={assetType}
                onChange={(e) => setAssetType(e.target.value as AssetType | "")}
                className="flex h-10 w-full rounded-xl border border-input bg-ink-charcoal/60 px-3 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Not specified</option>
                {ASSET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ASSET_TYPE_META[t].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-white">Evidence links</p>
              <div className="space-y-2">
                {links.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      name="evidenceLinks"
                      value={l}
                      onChange={(e) => setLinks(links.map((x, j) => (j === i ? e.target.value : x)))}
                      placeholder="https://dune.com/… · collection page · Discord stats"
                      maxLength={300}
                    />
                    {links.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => setLinks(links.filter((_, j) => j !== i))} aria-label="Remove link">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {links.length < 8 && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setLinks([...links, ""])}>
                    <Plus className="h-3.5 w-3.5" />
                    Add link
                  </Button>
                )}
              </div>
              <FieldError errors={Object.entries(fe).find(([k]) => k.startsWith("evidenceLinks"))?.[1]} />
            </div>

            {criteria && criteria.customRules.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-white">Attestations</p>
                <div className="space-y-2">
                  {criteria.customRules.map((rule) => (
                    <label key={rule.id} className="flex items-start gap-3 rounded-xl border border-border bg-ink-black/30 px-3 py-2.5">
                      <Checkbox
                        checked={attested.has(rule.id)}
                        onCheckedChange={(v) => {
                          const next = new Set(attested);
                          if (v === true) next.add(rule.id);
                          else next.delete(rule.id);
                          setAttested(next);
                        }}
                        className="mt-0.5"
                      />
                      <span className="text-sm text-foreground/90">{rule.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery</CardTitle>
            <CardDescription>Optional now — you&apos;ll confirm the full wallet list once approved.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <div>
              <Label htmlFor="walletForDelivery">Contact wallet</Label>
              <Input id="walletForDelivery" name="walletForDelivery" className="font-mono" placeholder="0x… / your chain address" maxLength={120} />
              <FieldError errors={fe.walletForDelivery} />
            </div>
            <div>
              <Label htmlFor="deliveryChain">Chain</Label>
              <select
                id="deliveryChain"
                name="deliveryChain"
                defaultValue={listing.chain}
                className="flex h-10 w-full rounded-xl border border-input bg-ink-charcoal/60 px-3 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ALL_CHAINS.map((c) => (
                  <option key={c} value={c}>
                    {CHAIN_META[c].label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-2xl border border-border bg-card bg-card-glow p-5 shadow-card">
          <EligibilityMeter result={eligibility} />
          <p className={cn("mt-4 text-xs", eligibility.eligible ? "text-emerald-300/90" : "text-amber-300/90")}>{outcomeHint}</p>
          <Button type="submit" size="lg" className="mt-5 w-full" disabled={pending || !teamId}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {pending ? "Submitting…" : "Submit request"}
          </Button>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Only {listing.teamName} sees your request.
          </p>
        </div>
      </aside>
    </form>
  );
}

function StatInput({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string[];
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d,]/g, ""))}
        placeholder="e.g. 12,000"
      />
      <FieldError errors={error} />
    </div>
  );
}

function SubmittedPanel({
  result,
  message,
  dashboardBase,
  listingHref,
}: {
  result: SubmitRequestResult;
  message?: string;
  dashboardBase: string;
  listingHref: string;
}) {
  const approved = result.status === "APPROVED";
  const waitlisted = result.status === "WAITLISTED";
  const Icon = approved ? Zap : waitlisted ? Hourglass : CheckCircle2;
  const meta = REQUEST_STATUS_META[result.status];
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card bg-card-glow p-8 text-center shadow-card">
      <div
        className={cn(
          "mx-auto grid h-14 w-14 place-items-center rounded-2xl",
          approved ? "bg-gold-gradient shadow-glow-gold" : "bg-crimson-gradient shadow-glow-red"
        )}
      >
        <Icon className="h-7 w-7 text-white" />
      </div>
      <p className="mt-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{meta.label}</p>
      <h2 className="mt-1 font-display text-2xl font-bold text-white">
        {approved ? `${result.spotsGranted} spots secured` : waitlisted ? "You're on the waitlist" : "Request filed"}
      </h2>
      {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild>
          <Link href={`${dashboardBase}/dashboard/${result.teamSlug}/collab/outgoing`}>Track on your desk</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={listingHref}>Back to listing</Link>
        </Button>
      </div>
    </div>
  );
}

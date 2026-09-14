"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import type { ContactMethod } from "@prisma/client";

import { submitRequestAction, type SubmitRequestResult } from "@/server/actions/collab";
import type { ActionState } from "@/server/actions/_result";
import type { RequesterTeamOption } from "@/server/queries/collab-public";
import { REQUEST_STATUS_META } from "@/lib/collab/constants";
import { COMMUNITY_PLATFORMS, CONTACT_METHODS, contactMethodMeta } from "@/lib/collab/socials";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FieldError, FormMessage } from "@/components/dashboard/form-message";
import { ImageUploadField } from "@/components/dashboard/image-upload-field";

/**
 * RequestForm — a project requests spots on a listing, via the fixed intake
 * form every request carries: community name/size/socials, optional raffle
 * proof, the ask, and how to reach them if chosen.
 */

type Result = ActionState<SubmitRequestResult>;
const initial: Result = { ok: false };

export function RequestForm({
  listing,
  teams,
  dashboardBase,
  listingHref,
  blockedReason,
  defaultContactName,
}: {
  listing: {
    id: string;
    title: string;
    teamName: string;
    spotsPerRequestMin: number;
    spotsPerRequestMax: number;
    available: number;
  };
  teams: RequesterTeamOption[];
  /** "" on the main host; the main host's origin on the Collab host. */
  dashboardBase: string;
  listingHref: string;
  /** Why a new request can't be filed right now (null = form is open). */
  blockedReason: string | null;
  /** Prefill for "Contact name" from the signed-in account. */
  defaultContactName: string;
}) {
  const [, startTransition] = useTransition();
  const action = useMemo(() => submitRequestAction.bind(null, listing.id), [listing.id]);
  const [state, formAction, pending] = useActionState(action, initial);

  const selectable = teams.filter((t) => !t.hasActiveRequest);
  const [teamId, setTeamId] = useState(selectable[0]?.id ?? "");
  const team = teams.find((t) => t.id === teamId) ?? null;
  const cap = Math.min(listing.spotsPerRequestMax, Math.max(listing.spotsPerRequestMin, listing.available));

  const [spots, setSpots] = useState(String(Math.min(cap, Math.max(listing.spotsPerRequestMin, 10))));
  const [communityName, setCommunityName] = useState(selectable[0]?.name ?? "");
  const [contactMethod, setContactMethod] = useState<ContactMethod>("X");

  function pickTeam(id: string) {
    const next = teams.find((t) => t.id === id);
    // Follow the team's name unless the requester already typed their own.
    if (!communityName.trim() || communityName === team?.name) setCommunityName(next?.name ?? "");
    setTeamId(id);
  }

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

  // Dispatch from onSubmit rather than <form action>: React resets a form after
  // an action runs, which would wipe this long form on a single validation error.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-2xl space-y-6">
      <FormMessage state={state} />
      <input type="hidden" name="requesterTeamId" value={teamId} />
      <input type="hidden" name="contactMethod" value={contactMethod} />

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
                  {t.hasActiveRequest ? "Already requested" : "Select to request"}
                </span>
              </span>
            </button>
          ))}
          <FieldError errors={fe.requesterTeamId} />
        </CardContent>
      </Card>

      {/* --- Community --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your community</CardTitle>
          <CardDescription>Who gets the spots. Shown to the reviewer as you enter it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="communityName">
              Community name <Req />
            </Label>
            <Input
              id="communityName"
              name="communityName"
              value={communityName}
              onChange={(e) => setCommunityName(e.target.value)}
              placeholder="e.g. Arch DAO"
              maxLength={80}
            />
            <FieldError errors={fe.communityName} />
          </div>

          <div className="max-w-[14rem]">
            <Label htmlFor="communitySize">
              Community size <Req />
            </Label>
            <Input id="communitySize" name="communitySize" inputMode="numeric" placeholder="e.g. 12000" />
            <FieldError errors={fe.communitySize} />
          </div>

          <div>
            <p className="mb-3 text-xs text-muted-foreground">Paste a link or just the @handle.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {COMMUNITY_PLATFORMS.map((p) => (
                <div key={p.key}>
                  <Label htmlFor={p.field}>
                    {p.label} {p.required && <Req />}
                  </Label>
                  <Input id={p.field} name={p.field} placeholder={p.placeholder} maxLength={300} autoComplete="off" />
                  <FieldError errors={fe[p.field]} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <ImageUploadField name="raffleProofImageUrl" label="Raffle proof image (optional)" folder="collab-proof" aspect="wide" />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              A screenshot of a raffle your community has run elsewhere — never oxbot&apos;s own entrant list, and it can be anyone&apos;s raffle.
            </p>
            <FieldError errors={fe.raffleProofImageUrl} />
          </div>
        </CardContent>
      </Card>

      {/* --- Ask --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your ask</CardTitle>
          <CardDescription>
            {listing.spotsPerRequestMin}–{listing.spotsPerRequestMax} WL spots per partner · {listing.available} available now
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-[14rem]">
            <Label htmlFor="spotsRequested">
              WL spots requested <Req />
            </Label>
            <Input
              id="spotsRequested"
              name="spotsRequested"
              type="number"
              min={listing.spotsPerRequestMin}
              max={listing.spotsPerRequestMax}
              value={spots}
              onChange={(e) => setSpots(e.target.value)}
            />
            <FieldError errors={fe.spotsRequested} />
          </div>
        </CardContent>
      </Card>

      {/* --- Contact --- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Who to contact if chosen</CardTitle>
          <CardDescription>Only {listing.teamName} sees this — for coordinating the allocation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="contactName">
              Contact name <Req />
            </Label>
            <Input id="contactName" name="contactName" defaultValue={defaultContactName} maxLength={80} autoComplete="name" />
            <FieldError errors={fe.contactName} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-white">
              Reach them via <Req />
            </p>
            <div className="grid grid-cols-3 gap-2">
              {CONTACT_METHODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setContactMethod(m.key)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                    contactMethod === m.key
                      ? "border-primary/60 bg-primary/10 text-white shadow-glow-red"
                      : "border-border bg-card/40 text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="contactHandle">
              {contactMethodMeta(contactMethod).label} handle <Req />
            </Label>
            <Input
              id="contactHandle"
              name="contactHandle"
              placeholder={contactMethodMeta(contactMethod).placeholder}
              maxLength={64}
              autoComplete="off"
            />
            <FieldError errors={fe.contactHandle} />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" className="w-full" disabled={pending || !teamId}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {pending ? "Submitting…" : "Submit request"}
      </Button>
      <p className="text-center text-[11px] text-muted-foreground">Only {listing.teamName} sees your request.</p>
    </form>
  );
}

function Req() {
  return <span className="text-primary">*</span>;
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
  const meta = REQUEST_STATUS_META[result.status];
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card bg-card-glow p-8 text-center shadow-card">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-crimson-gradient shadow-glow-red">
        <CheckCircle2 className="h-7 w-7 text-white" />
      </div>
      <p className="mt-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{meta.label}</p>
      <h2 className="mt-1 font-display text-2xl font-bold text-white">Request filed</h2>
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

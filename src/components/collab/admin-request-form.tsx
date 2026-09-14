"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import type { ContactMethod } from "@prisma/client";

import { adminAddRequestAction } from "@/server/actions/collab";
import type { ActionState } from "@/server/actions/_result";
import { COMMUNITY_PLATFORMS, CONTACT_METHODS, contactMethodMeta } from "@/lib/collab/socials";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, FormMessage } from "@/components/dashboard/form-message";
import { ImageUploadField } from "@/components/dashboard/image-upload-field";

/**
 * AdminRequestForm — a platform admin files a request on behalf of a project
 * with no oxbot account. Same fixed fields as the self-service RequestForm,
 * minus the team picker (there's no team) and minus the "which desk sees
 * this" framing.
 */
type Result = ActionState<{ requestId: string }>;
const initial: Result = { ok: false };

export function AdminRequestForm({
  listingId,
  listingTitle,
  spotsPerRequestMin,
  spotsPerRequestMax,
  available,
  backHref,
}: {
  listingId: string;
  listingTitle: string;
  spotsPerRequestMin: number;
  spotsPerRequestMax: number;
  available: number;
  backHref: string;
}) {
  const [state, formAction, pending] = useActionState(adminAddRequestAction.bind(null, listingId), initial);
  const [contactMethod, setContactMethod] = useState<ContactMethod>("X");
  const cap = Math.min(spotsPerRequestMax, Math.max(spotsPerRequestMin, available));
  const [spots, setSpots] = useState(String(Math.min(cap, Math.max(spotsPerRequestMin, 10))));

  if (state.ok && state.data) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card bg-card-glow p-8 text-center shadow-card">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-crimson-gradient shadow-glow-red">
          <CheckCircle2 className="h-7 w-7 text-white" />
        </div>
        <h2 className="mt-5 font-display text-2xl font-bold text-white">Request added</h2>
        <p className="mt-3 text-sm text-muted-foreground">{state.message}</p>
        <Button asChild className="mt-6">
          <Link href={backHref}>Back to listings</Link>
        </Button>
      </div>
    );
  }

  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="mx-auto max-w-2xl space-y-6">
      <FormMessage state={state} />
      <input type="hidden" name="contactMethod" value={contactMethod} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Community</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="communityName">
              Community name <Req />
            </Label>
            <Input id="communityName" name="communityName" placeholder="e.g. Arch DAO" maxLength={80} />
            <FieldError errors={fe.communityName} />
          </div>
          <div className="max-w-[14rem]">
            <Label htmlFor="communitySize">
              Community size <Req />
            </Label>
            <Input id="communitySize" name="communitySize" inputMode="numeric" placeholder="e.g. 12000" />
            <FieldError errors={fe.communitySize} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
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
          <div>
            <ImageUploadField name="raffleProofImageUrl" label="Raffle proof image (optional)" folder="collab-proof" aspect="wide" />
            <FieldError errors={fe.raffleProofImageUrl} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ask</CardTitle>
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
              min={spotsPerRequestMin}
              max={spotsPerRequestMax}
              value={spots}
              onChange={(e) => setSpots(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {spotsPerRequestMin}–{spotsPerRequestMax} per partner · {available} available now on {listingTitle}
            </p>
            <FieldError errors={fe.spotsRequested} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Who to contact if chosen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="contactName">
              Contact name <Req />
            </Label>
            <Input id="contactName" name="contactName" maxLength={80} autoComplete="off" />
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

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {pending ? "Adding…" : "Add request"}
      </Button>
    </form>
  );
}

function Req() {
  return <span className="text-primary">*</span>;
}

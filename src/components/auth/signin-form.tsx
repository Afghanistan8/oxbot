"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Loader2, CheckCircle2, ArrowRight, MessageCircle, ShieldCheck } from "lucide-react";

import { emailSignInAction, oauthSignInAction, type SignInState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Sign-in form: email magic link + optional OAuth buttons. The parent server
 * component decides which OAuth providers are available (passed as props).
 */
export function SignInForm({
  twitterEnabled,
  discordEnabled,
}: {
  twitterEnabled: boolean;
  discordEnabled: boolean;
}) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [state, formAction, pending] = useActionState<SignInState, FormData>(
    emailSignInAction,
    {}
  );
  // Discord is the only sign-in method offered when it's configured — X and
  // email are only shown as a fallback on deployments without Discord set up,
  // so nobody is ever locked out of an unconfigured environment.
  const [showEmail, setShowEmail] = useState(!discordEnabled);

  if (state.sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <CheckCircle2 className="h-7 w-7 text-emerald-400" />
        </div>
        <div className="space-y-1">
          <h2 className="font-display text-xl font-semibold">Check your inbox</h2>
          <p className="text-sm text-muted-foreground">
            We sent a sign-in link to{" "}
            <span className="text-foreground">{state.email}</span>.
          </p>
        </div>
        {state.devMagicLink ? (
          <div className="w-full space-y-2 rounded-xl border border-primary/30 bg-primary/10 p-3">
            <p className="text-xs font-medium text-scarlet-soft">
              Dev mock mode — no SMTP configured
            </p>
            <Button asChild className="w-full" size="lg">
              <a href={state.devMagicLink}>
                Continue signing in
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        ) : (
          <p className="rounded-xl border border-border bg-ink-charcoal/60 px-3 py-2 text-xs text-muted-foreground">
            Dev tip: in mock mode the link is printed to your{" "}
            <span className="text-scarlet-soft">server console</span>.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Discord is the primary login — verifies identity across every giveaway
          (member/role checks, follow tasks) in one step. */}
      {discordEnabled && (
        <div className="space-y-3">
          <form action={oauthSignInAction}>
            <input type="hidden" name="provider" value="discord" />
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <Button type="submit" className="w-full" size="lg">
              <MessageCircle className="h-4 w-4" />
              Continue with Discord
            </Button>
          </form>
          <p className="flex items-center gap-1.5 text-center text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-scarlet-soft" />
            Your primary login — powers Discord-gated entry checks automatically.
          </p>
        </div>
      )}

      {/* X and email are only ever shown when Discord isn't configured on
          this deployment — a fallback so local/dev setups still work, never
          a real alternative once Discord is live. */}
      {!discordEnabled && twitterEnabled && (
        <form action={oauthSignInAction}>
          <input type="hidden" name="provider" value="twitter" />
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <Button type="submit" className="w-full" size="lg">
            Continue with X
          </Button>
        </form>
      )}

      {!discordEnabled && twitterEnabled && (
        <div className="relative py-1">
          <div className="divider-glow" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
            or
          </span>
        </div>
      )}

      {!discordEnabled &&
        (showEmail ? (
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@wallet.eth"
                defaultValue={state.email}
                required
              />
            </div>
            {state.error && (
              <p className="text-xs text-destructive">{state.error}</p>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {pending ? "Sending link…" : "Continue with email"}
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowEmail(true)}
            className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-scarlet-soft hover:underline"
          >
            Sign in with email instead
          </button>
        ))}
    </div>
  );
}

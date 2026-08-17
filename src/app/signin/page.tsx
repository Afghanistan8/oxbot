import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleAlert } from "lucide-react";

import { brand } from "@/lib/brand";
import { integrations } from "@/lib/env";
import { getCurrentUserId } from "@/lib/session";
import { Logo } from "@/components/brand/logo";
import { SignInForm } from "@/components/auth/signin-form";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Sign in" };

/**
 * Auth.js redirects here with ?error=<code> on any sign-in failure (this page
 * is configured as `pages.error`). Without this mapping the page just showed
 * the normal form with no explanation — a real gap: a failed sign-in looked
 * identical to a fresh visit, giving the user nothing to act on.
 */
function buildErrorMessages(discordLive: boolean): Record<string, string> {
  return {
    OAuthAccountNotLinked: discordLive
      ? "This account is already linked to a different sign-in method. Try continuing with Discord using the account you originally signed up with."
      : "This email is already linked to a different sign-in method. Try the method you originally used — or sign in with email to link this account.",
    OAuthSignin: "Couldn't start the sign-in request. Please try again.",
    OAuthCallback: "Discord didn't confirm the sign-in. Please try again.",
    OAuthCreateAccount: "Couldn't create an account from that sign-in. Please try again.",
    EmailCreateAccount: "Couldn't create an account with that email. Please try again.",
    EmailSignin: "Couldn't send the sign-in link. Please try again in a moment.",
    Callback: "Something went wrong completing sign-in. Please try again.",
    AccessDenied: "Access denied. You may have cancelled the sign-in request.",
    Verification: "That sign-in link has expired or was already used. Request a new one.",
    Configuration: "Sign-in isn't configured correctly. Please try again shortly.",
    Default: "Something went wrong signing you in. Please try again.",
  };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  // Already signed in? Go to the dashboard.
  const userId = await getCurrentUserId();
  if (userId) redirect("/dashboard");

  const { error } = await searchParams;
  const errorMessages = buildErrorMessages(integrations.discord.oauthLive);
  const errorMessage = error ? (errorMessages[error] ?? errorMessages.Default) : null;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      {/* Ambient hero glow */}
      <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
      <div className="pointer-events-none absolute inset-0 bg-grid-red opacity-40 mask-fade-bottom" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo size="lg" showText={false} href="/" />
          <div className="space-y-1.5">
            <h1 className="font-display text-3xl font-bold tracking-tight">
              Welcome to <span className="text-gradient-crimson">{brand.name}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {integrations.discord.oauthLive
                ? "Continue with Discord — it verifies your identity across every giveaway."
                : "Sign in to create giveaways or enter one."}
            </p>
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
        )}

        <Card glow className="p-6 sm:p-8">
          <Suspense
            fallback={
              <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
            }
          >
            <SignInForm
              twitterEnabled={integrations.twitter.oauthLive}
              discordEnabled={integrations.discord.oauthLive}
            />
          </Suspense>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to the{" "}
          <Link href="/terms" className="text-scarlet-soft hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-scarlet-soft hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

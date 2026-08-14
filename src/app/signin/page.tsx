import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { brand } from "@/lib/brand";
import { integrations } from "@/lib/env";
import { getCurrentUserId } from "@/lib/session";
import { Logo } from "@/components/brand/logo";
import { SignInForm } from "@/components/auth/signin-form";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  // Already signed in? Go to the dashboard.
  const userId = await getCurrentUserId();
  if (userId) redirect("/dashboard");

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

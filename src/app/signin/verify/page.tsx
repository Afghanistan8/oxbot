import Link from "next/link";
import { MailCheck } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Check your email" };

export default function VerifyRequestPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" href="/" />
        </div>
        <Card glow className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 ring-1 ring-primary/30">
            <MailCheck className="h-7 w-7 text-scarlet-soft" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-display text-2xl font-bold">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              A sign-in link has been sent to your email address. Click it to
              continue.
            </p>
          </div>
          <p className="rounded-xl border border-border bg-ink-charcoal/60 px-3 py-2 text-xs text-muted-foreground">
            In dev mock mode, the link prints to your{" "}
            <span className="text-scarlet-soft">server console</span>.
          </p>
          <Button asChild variant="ghost" className="mt-2">
            <Link href="/signin">Back to sign in</Link>
          </Button>
        </Card>
      </div>
    </main>
  );
}

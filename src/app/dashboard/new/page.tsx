import Link from "next/link";
import { ArrowLeft, Handshake, Gift, MessageCircle } from "lucide-react";

import { requireUser } from "@/lib/session";
import { CreateTeamForm } from "@/components/dashboard/create-team-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "New community profile" };

/**
 * Create-project page. Auth is enforced by the dashboard layout, but we call
 * requireUser here too so the page is safe if ever rendered standalone.
 */
export default async function NewTeamPage() {
  await requireUser("/dashboard/new");

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to projects
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Create your community profile</CardTitle>
          <CardDescription>
            This is your community&apos;s home on oxbot. You&apos;ll be the owner
            and can invite teammates later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* What a profile unlocks — reinforces the "you have options" idea. */}
          <div className="space-y-3 rounded-xl border border-border bg-ink-black/40 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              With a profile you can
            </p>
            <div className="flex items-start gap-3">
              <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <p className="text-sm text-foreground/90">
                <span className="font-semibold text-white">Request whitelist spots</span> for your
                community on projects listed on the Collab desk.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Gift className="mt-0.5 h-4 w-4 shrink-0 text-scarlet-soft" />
              <p className="text-sm text-foreground/90">
                <span className="font-semibold text-white">Run your own giveaways</span> — raffles,
                first-come drops and code rewards for your members.
              </p>
            </div>
            <div className="flex items-start gap-3 border-t border-border/60 pt-3">
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#5865F2]" />
              <p className="text-sm text-foreground/90">
                Run a <span className="font-semibold text-white">Discord community</span>? Since you
                signed in with Discord, you can host giveaways for your members with automatic
                Discord role &amp; membership checks.
              </p>
            </div>
          </div>

          <CreateTeamForm />
        </CardContent>
      </Card>
    </div>
  );
}

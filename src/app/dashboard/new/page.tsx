import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { requireUser } from "@/lib/session";
import { CreateTeamForm } from "@/components/dashboard/create-team-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "New project" };

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
          <CardTitle>Create a project</CardTitle>
          <CardDescription>
            Your project is the home for your brand and giveaways. You&apos;ll be
            the owner and can invite teammates later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateTeamForm />
        </CardContent>
      </Card>
    </div>
  );
}

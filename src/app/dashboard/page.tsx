import Link from "next/link";
import { Gift, Users, Plus, ArrowRight, Rocket } from "lucide-react";

import { requireUser } from "@/lib/session";
import { getTeamsForUser } from "@/server/queries/teams";
import { ROLE_META } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Dashboard index — lists the user's projects (teams). Empty state guides the
 * user to create their first project.
 */
export default async function DashboardHome() {
  const user = await requireUser("/dashboard");
  const teams = await getTeamsForUser(user.id);

  if (teams.length === 0) {
    return <EmptyProjects />;
  }

  return (
    <>
      <PageHeader title="Your projects" description="Manage teams and their giveaways.">
        <Button asChild>
          <Link href="/dashboard/new">
            <Plus className="h-4 w-4" />
            New project
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map((team) => (
          <Link
            key={team.id}
            href={`/dashboard/${team.slug}`}
            className="group rounded-2xl border border-border bg-card bg-card-glow p-5 shadow-card transition-all duration-300 hover:border-primary/50 hover:shadow-glow-red"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-crimson-gradient shadow-glow-red">
                  {team.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={team.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-display text-lg font-bold text-white">
                      {team.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-white">
                    {team.name}
                  </h3>
                  <Badge variant="muted" className="mt-1">
                    {ROLE_META[team.role].label}
                  </Badge>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-scarlet-soft" />
            </div>

            <div className="mt-5 flex items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Gift className="h-4 w-4" />
                {formatNumber(team.giveawayCount)} giveaway
                {team.giveawayCount === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                {formatNumber(team.memberCount)} member
                {team.memberCount === 1 ? "" : "s"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function EmptyProjects() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-crimson-gradient shadow-glow-red-lg">
        <Rocket className="h-8 w-8 text-white" />
      </div>
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-white">
        Create your first project
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        A project is your team&apos;s home for giveaways — your brand, your
        members, your drops. Set one up in seconds.
      </p>
      <Button asChild size="lg" className="mt-8">
        <Link href="/dashboard/new">
          <Plus className="h-4 w-4" />
          New project
        </Link>
      </Button>
    </div>
  );
}

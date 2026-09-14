import Link from "next/link";
import { Gift, Users, Plus, ArrowRight, Handshake } from "lucide-react";

import { requireUser } from "@/lib/session";
import { getTeamsForUser } from "@/server/queries/teams";
import { ROLE_META } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Dashboard index — lists the user's projects (teams). New users (no project
 * yet) get a bold "you have options" welcome that spells out both ways to use
 * oxbot; returning users get their project grid with a Collab-desk nudge.
 */
export default async function DashboardHome() {
  const user = await requireUser("/dashboard");
  const teams = await getTeamsForUser(user.id);

  if (teams.length === 0) {
    return <WelcomeOptions />;
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

      <CollabNudge />

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

/**
 * Slim, always-on reminder for founders/collab managers who already have a
 * project: they can also request whitelist spots for their community on the
 * Collab desk. Keeps the "you have options" idea discoverable after onboarding.
 */
function CollabNudge() {
  return (
    <Link
      href="/collab/listings"
      className="group mb-6 flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/[0.06] px-5 py-4 transition-colors hover:border-gold/60"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
        <Handshake className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">
          Want whitelist spots for your community?
        </p>
        <p className="text-xs text-muted-foreground">
          Browse the Collab desk and request allocations from listed NFT &amp; token projects.
        </p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-gold transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/**
 * First-run welcome for a signed-in user with no project yet. Makes the two
 * ways to use oxbot explicit and bold — request collab spots for a community,
 * or run your own giveaways — both unlocked by one community profile.
 */
function WelcomeOptions() {
  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-scarlet-soft">
          Welcome to oxbot
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Set up your <span className="text-gradient-crimson">community profile</span>
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
          It&apos;s your community&apos;s home on oxbot — logo, socials and chains.
          One profile unlocks <span className="font-semibold text-white">both</span> ways to use
          oxbot. You choose:
        </p>
      </div>

      {/* The two options */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gold/30 bg-gold/[0.06] p-5">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gold/15 text-gold">
            <Handshake className="h-5 w-5" />
          </div>
          <h2 className="mt-4 font-display text-lg font-semibold text-white">
            Request whitelist spots
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Founder or collab manager? Pitch your community for allocations on NFT
            &amp; token projects listed on the Collab desk.
          </p>
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-5">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-crimson-gradient text-white shadow-glow-red">
            <Gift className="h-5 w-5" />
          </div>
          <h2 className="mt-4 font-display text-lg font-semibold text-white">
            Run your own giveaways
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Host raffles, first-come drops and code rewards for your members — with
            automatic Discord &amp; X task checks.
          </p>
        </div>
      </div>

      {/* Primary action */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href="/dashboard/new">
            <Plus className="h-4 w-4" />
            Create your community profile
          </Link>
        </Button>
        <Link
          href="/collab/listings"
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-scarlet-soft hover:underline"
        >
          Just browsing? See open whitelist listings →
        </Link>
      </div>
    </div>
  );
}

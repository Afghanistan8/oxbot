import Link from "next/link";
import type { ComponentType } from "react";
import {
  LogIn,
  Gift,
  Users,
  Trophy,
  Handshake,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";

import { brand } from "@/lib/brand";
import { integrations } from "@/lib/env";
import { discordBotInviteUrl } from "@/lib/discord-invite";

import { SiteHeader } from "@/components/brand/site-header";
import { SiteFooter } from "@/components/brand/site-footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "How it works" };

/**
 * How it works — a short, precise overview of the whole platform: signing in,
 * entering giveaways, creating a community profile, running giveaways, and the
 * Collab whitelist desk. Deliberately concise; deep setup lives in-product.
 */
export default function GuidePage() {
  const inviteUrl = discordBotInviteUrl();

  return (
    <>
      <SiteHeader />

      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
        <div className="pointer-events-none absolute inset-0 bg-grid-red opacity-30 mask-fade-bottom" />

        <div className="container relative max-w-3xl py-16">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-scarlet-soft">
              How it works
            </p>
            <h1 className="mt-3 font-display text-4xl font-black tracking-tight text-white sm:text-5xl">
              How <span className="text-gradient-crimson">{brand.name}</span> works
            </h1>
            <p className="mt-4 text-muted-foreground">
              Three things happen here: people enter giveaways, projects run them, and communities
              trade whitelist spots. Here&apos;s how each one works.
            </p>
          </div>

          <div className="mt-12 space-y-4">
            <Item icon={LogIn} title="Sign in with Discord">
              Discord is the only way to sign in. It also does the follow, join and role checks for
              you, so there&apos;s nothing else to hook up.
            </Item>

            <Item icon={Gift} title="Enter a giveaway">
              Anyone can enter, no profile required. Open a giveaway and do what it asks: follow on
              X, join a Discord, hold a role, or drop in a code. Each task ticks off as you finish
              it. Winners are drawn at random (with a seed you can check) or first-come for the
              fastest valid entries. Only the project running it sees who entered, and your wins show
              up on your{" "}
              <Link href="/profile#wins" className="text-scarlet-soft hover:text-white">
                profile
              </Link>
              .
            </Item>

            <Item icon={Users} title="Create a community profile">
              If you run a project or manage collabs, set up a profile. It holds your logo, socials
              and chains, and it&apos;s what lets you run giveaways or ask for whitelist spots. Bring
              in teammates as Owner, Admin, or Collab Manager.
            </Item>

            <Item icon={Trophy} title="Run your own giveaways">
              Connect your Discord first (invite the bot and paste your server ID) so it can see
              who&apos;s a member or has a role. Then set the giveaway up: pick random, first-come or
              code, add the tasks, choose who can see it, and publish. It posts to your channel on
              its own. Once entries close, draw the winners from your dashboard. Only your team sees
              the entrant list.
              {inviteUrl && (
                <>
                  {" "}
                  <a
                    href={inviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-scarlet-soft hover:text-white"
                  >
                    Invite the bot <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </Item>

            <Item icon={Handshake} title="Trade whitelist spots on Collab">
              Two sides to it. If you have a mint or token coming up, list your spare whitelist spots
              and say how many each partner can take. If you want spots, open the{" "}
              <Link href="/collab/listings" className="text-scarlet-soft hover:text-white">
                Collab desk
              </Link>
              , find a listing, and send a short pitch about your community. The project reads it
              privately and decides who gets what, and you can follow your request from your desk.
            </Item>

            <Item icon={ShieldCheck} title="A couple of things worth knowing">
              Public and community giveaways need a Discord server ID; private code-gated ones
              don&apos;t. The bot only checks membership and roles, so it never posts or DMs anyone.
              {!integrations.email.live &&
                " On this setup, sign-in shows an in-app link instead of emailing one."}
            </Item>
          </div>

          <div className="mt-14 flex flex-col items-center gap-3 rounded-3xl border border-primary/30 bg-crimson-gradient p-10 text-center shadow-glow-red-lg">
            <Badge variant="gold">Ready when you are</Badge>
            <h2 className="font-display text-2xl font-bold text-white">Get started</h2>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="gold">
                <Link href="/dashboard/new">Create a community profile</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/">Explore giveaways</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function Item({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex gap-4 pt-6">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-crimson-gradient shadow-glow-red">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
        </div>
      </CardContent>
    </Card>
  );
}

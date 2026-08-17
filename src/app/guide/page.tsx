import Link from "next/link";
import {
  LogIn,
  ShieldCheck,
  FolderPlus,
  MessageCircle,
  Gift,
  Trophy,
  CheckCircle2,
  ExternalLink,
  CircleAlert,
  Lock,
  Users,
} from "lucide-react";

import { brand } from "@/lib/brand";
import { integrations } from "@/lib/env";
import { discordBotInviteUrl } from "@/lib/discord-invite";

import { SiteHeader } from "@/components/brand/site-header";
import { SiteFooter } from "@/components/brand/site-footer";
import { CopyCode } from "@/components/brand/copy-code";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "How to use" };

const TOC = [
  { href: "#participants", label: "Entering a giveaway" },
  { href: "#project", label: "1. Create your project" },
  { href: "#discord", label: "2. Connect your Discord server" },
  { href: "#giveaway", label: "3. Create a giveaway" },
  { href: "#bot-channel", label: "4. How it runs in your Discord channel" },
  { href: "#manage", label: "5. Publish & manage" },
  { href: "#troubleshooting", label: "Troubleshooting" },
];

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
              Guide
            </p>
            <h1 className="mt-3 font-display text-4xl font-black tracking-tight text-white sm:text-5xl">
              How to use <span className="text-gradient-crimson">{brand.name}</span>
            </h1>
            <p className="mt-4 text-muted-foreground">
              Whether you&apos;re entering a drop or running one for your own
              community, here&apos;s the whole flow — start to finish.
            </p>
          </div>

          {/* Table of contents */}
          <nav className="mt-10 flex flex-wrap justify-center gap-2 rounded-2xl border border-border bg-card/40 p-3">
            {TOC.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/40 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-14 space-y-12">
            {/* --- Participants --- */}
            <Section
              id="participants"
              icon={Gift}
              title="Entering a giveaway"
              description="No project of your own needed — just sign in and complete the tasks."
            >
              <Steps>
                <Step
                  icon={LogIn}
                  title="Sign in"
                  body={
                    integrations.discord.oauthLive
                      ? "Sign in with Discord — it's the only way to create an account, and it verifies your identity across every giveaway automatically."
                      : "Sign in to get started."
                  }
                />
                <Step
                  icon={CheckCircle2}
                  title="Complete the tasks"
                  body="Each giveaway lists its own requirements — follow an account, join a Discord server, hold a role, enter a code. Statuses update live as you finish each one."
                />
                <Step
                  icon={Lock}
                  title="Your entry stays private"
                  body="Only the project's own team can ever see who entered. Public pages never show entrant identities."
                />
                <Step
                  icon={Trophy}
                  title="Check your wins"
                  body="Random draws use a seeded CSPRNG (reproducible and auditable); FCFS rewards the fastest valid entries. See your history any time on your profile."
                  href="/profile#wins"
                  linkLabel="My wins"
                />
              </Steps>
            </Section>

            {/* --- 1. Project --- */}
            <Section
              id="project"
              icon={FolderPlus}
              title="1. Create your project"
              description="This is the home for your brand and every giveaway you run."
            >
              <Steps>
                <Step
                  icon={LogIn}
                  title="Sign in, then open your dashboard"
                  body="Use the account you want to own the project — you'll be its Owner, with full control including who else can manage it."
                  href="/dashboard/new"
                  linkLabel="Create a project"
                />
                <Step
                  icon={Users}
                  title="Invite your team"
                  body="Under Members, invite teammates as Admin (manages members & settings) or Raffle Manager (runs giveaways without full admin access)."
                />
              </Steps>
            </Section>

            {/* --- 2. Discord --- */}
            <Section
              id="discord"
              icon={MessageCircle}
              title="2. Connect your Discord server"
              description="Required before you can gate a giveaway on server membership or roles."
            >
              <Steps>
                <Step
                  icon={ShieldCheck}
                  title="You'll need Manage Server permission"
                  body="On the Discord server you want to connect — not on oxbot itself. Anyone with that permission on their own server can connect it."
                />
                <li className="flex gap-4">
                  <StepIcon icon={ExternalLink} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">Invite the oxbot bot</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This is what checks server membership and roles when
                      entrants complete Discord-gated tasks on the giveaway
                      page.
                    </p>
                    {inviteUrl ? (
                      <div className="mt-3">
                        <CopyCode value={inviteUrl} label="Copy invite link" />
                        <a
                          href={inviteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-scarlet-soft hover:text-white"
                        >
                          Open invite link <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ) : (
                      <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                        Discord isn&apos;t configured on this deployment yet — the
                        invite link needs <code>AUTH_DISCORD_ID</code> set.
                      </p>
                    )}
                  </div>
                </li>
                <Step
                  icon={CircleAlert}
                  title="Using a security bot like Wick or Dyno?"
                  body='Anti-nuke bots often auto-kick new bots by default — usually under a rule like "unverified bot additions" or "minimum account age." If oxbot vanishes right after joining, check its settings and whitelist oxbot, or lower/disable the rule that caught it.'
                />
                <Step
                  icon={CheckCircle2}
                  title="Copy your server ID"
                  body="In Discord: User Settings → Advanced → enable Developer Mode. Then right-click your server's icon → Copy Server ID."
                />
                <Step
                  icon={FolderPlus}
                  title="Paste it into oxbot"
                  body="Under your project's Settings (once, for all giveaways) or a specific giveaway's Project links (per giveaway) — paste the server ID into Discord server ID."
                />
              </Steps>
            </Section>

            {/* --- 3. Giveaway --- */}
            <Section
              id="giveaway"
              icon={Gift}
              title="3. Create a giveaway"
              description="Three engines, and any combination of entry tasks."
            >
              <Steps>
                <Step
                  icon={FolderPlus}
                  title="Basics & format"
                  body="Title, prize, description, banner. Pick Random Raffle, First-Come-First-Served, or Code-based — this can't be changed once entries exist."
                />
                <Step
                  icon={CheckCircle2}
                  title="Entry requirements"
                  body="Add any combination: CAPTCHA, email, code, X follow/like/repost, Join Discord, or Hold a Discord role. For the two Discord tasks, click Load roles from Discord to pick real roles instead of typing IDs."
                />
                <Step
                  icon={Lock}
                  title="Visibility"
                  body="Public (listed, anyone can enter), Community (gated to your Discord/Telegram), or Private (code-gated, shared directly — the only visibility that doesn't require a Discord server ID)."
                />
                <Step
                  icon={MessageCircle}
                  title="Project links"
                  body="X account, Discord server ID, Telegram. The Discord server ID here is what every Discord-based requirement checks against."
                />
              </Steps>
            </Section>

            {/* --- 4. Bot & channel --- */}
            <Section
              id="bot-channel"
              icon={MessageCircle}
              title="4. How it runs in your Discord channel"
              description="Two separate jobs — a webhook that posts, and a bot that verifies."
            >
              <Steps>
                <Step
                  icon={ExternalLink}
                  title="Create a webhook for your giveaway channel"
                  body="In Discord: open the channel you want giveaways posted to → Edit Channel → Integrations → Webhooks → New Webhook. Copy its URL."
                />
                <Step
                  icon={FolderPlus}
                  title="Paste the webhook URL into oxbot"
                  body="Under your project's Settings, paste it into Discord webhook URL. This is separate from the server ID used for gating — it only controls where announcements post."
                />
                <Step
                  icon={Gift}
                  title="Publishing posts it automatically"
                  body="The moment a giveaway is published, oxbot posts an embed to that channel — title, prize, chain, format, banner, and a live countdown to when entries close. No manual copy-paste needed."
                />
                <Step
                  icon={ShieldCheck}
                  title="The bot verifies, it doesn't post"
                  body="The oxbot bot you invited in step 2 has one job: when someone completes a Join Discord or Hold a role task on the giveaway page, it checks their membership/roles in your server in real time. It never posts messages or runs commands in Discord."
                />
                <Step
                  icon={Trophy}
                  title="After you draw, announce winners yourself"
                  body="oxbot doesn't auto-post or auto-DM winners to Discord today — draw them on the giveaway's dashboard, then share the results back into your channel (e.g. paste the giveaway link, which shows winners once you publish the draw)."
                />
              </Steps>
            </Section>

            {/* --- 5. Manage --- */}
            <Section
              id="manage"
              icon={Trophy}
              title="5. Publish & manage"
              description="Everything after launch happens on the giveaway's dashboard page."
            >
              <Steps>
                <Step
                  icon={Users}
                  title="Entrants (private)"
                  body="Only your team ever sees this list — full identity, per-task status, and a CSV export. Public pages never leak who entered."
                />
                <Step
                  icon={Trophy}
                  title="Draw winners"
                  body="Available once entry closes. Random Raffle draws are seeded and reproducible; FCFS just locks in the fastest valid entries. Re-roll any time for a fresh seeded draw."
                />
                <Step
                  icon={ShieldCheck}
                  title="Audit log"
                  body="Every team mutation — giveaway changes, role changes, draws — is recorded for accountability."
                />
              </Steps>
            </Section>

            {/* --- Troubleshooting --- */}
            <Section
              id="troubleshooting"
              icon={CircleAlert}
              title="Troubleshooting"
            >
              <div className="space-y-3">
                <Faq
                  q="Load roles from Discord shows an error"
                  a="Either oxbot hasn't been invited to that server, or a security bot kicked it — see the anti-nuke note in step 2. You can still paste role IDs manually as a fallback."
                />
                <Faq
                  q='"Set a Discord server ID" error when publishing'
                  a="A Discord server ID is required for Public and Community giveaways. Either add one under Project links, or switch visibility to Private."
                />
                <Faq
                  q="Sharing a giveaway link shows no image on Discord/WhatsApp"
                  a="Set a banner on the giveaway — if it has none, a default branded image is used automatically, so this should be rare."
                />
                {!integrations.email.live && (
                  <Faq
                    q="Magic-link sign-in email never arrives"
                    a='This environment has no email provider configured, so sign-in uses an in-app link instead — after submitting your email, use the "Continue signing in" button shown on the confirmation screen.'
                  />
                )}
              </div>
            </Section>
          </div>

          <div className="mt-16 flex flex-col items-center gap-3 rounded-3xl border border-primary/30 bg-crimson-gradient p-10 text-center shadow-glow-red-lg">
            <Badge variant="gold">Ready when you are</Badge>
            <h2 className="font-display text-2xl font-bold text-white">
              Start your first project
            </h2>
            <Button asChild size="lg" variant="gold" className="mt-2">
              <Link href="/dashboard/new">Create a project</Link>
            </Button>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function Section({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-crimson-gradient shadow-glow-red">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-white">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">{children}</CardContent>
      </Card>
    </section>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ul className="space-y-5">{children}</ul>;
}

function StepIcon({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-card/60">
      <Icon className="h-4 w-4 text-scarlet-soft" />
    </div>
  );
}

function Step({
  icon,
  title,
  body,
  href,
  linkLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <li className="flex gap-4">
      <StepIcon icon={icon} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        {href && (
          <Link
            href={href}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-scarlet-soft hover:text-white"
          >
            {linkLabel ?? "Open"} →
          </Link>
        )}
      </div>
    </li>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-xl border border-border bg-ink-black/30 p-4">
      <p className="text-sm font-medium text-white">{q}</p>
      <p className="mt-1 text-sm text-muted-foreground">{a}</p>
    </div>
  );
}

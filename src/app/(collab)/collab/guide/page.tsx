import Link from "next/link";
import {
  BadgeCheck,
  Download,
  FolderPlus,
  Inbox,
  Layers,
  Lock,
  PackageCheck,
  Send,
  Wallet,
} from "lucide-react";

import { brandCollab } from "@/lib/brand-collab";
import { joinCollabPath } from "@/lib/collab/host";
import { getCollabSurface, mainSiteHref } from "@/lib/collab/surface";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "How Collab works" };

const TOC = [
  { href: "#list", label: "1. List inventory" },
  { href: "#request", label: "2. Request spots" },
  { href: "#review", label: "3. Review & deliver" },
  { href: "#faq", label: "FAQ" },
];

/** The OxFoxes Collab guide — for listing teams and requesters. */
export default async function CollabGuidePage() {
  const surface = await getCollabSurface();
  const href = (p: string) => joinCollabPath(surface.base, p);
  const [dashboardHref, newProjectHref] = await Promise.all([
    mainSiteHref("/dashboard"),
    mainSiteHref("/dashboard/new"),
  ]);

  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
      <div className="pointer-events-none absolute inset-0 bg-grid-red opacity-30 mask-fade-bottom" />

      <div className="container relative max-w-3xl py-16">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-scarlet-soft">Guide</p>
          <h1 className="mt-3 font-display text-4xl font-black tracking-tight text-white sm:text-5xl">
            How <span className="text-gradient-crimson">{brandCollab.name}</span> works
          </h1>
          <p className="mt-4 text-muted-foreground">
            A desk for whitelist deals: projects list spots, communities request them with one fixed form, and the
            desk keeps count so nothing gets oversold.
          </p>
        </div>

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
          <Section id="list" icon={Layers} title="1. List inventory" description="For projects with whitelist spots to hand out.">
            <Steps>
              <Step
                icon={FolderPlus}
                title="Set up your project"
                body="Collab uses your oxbot project — name, logo, socials, chains, mint details. A complete profile makes your listing more credible."
                href={newProjectHref}
                linkLabel="Create a project"
              />
              <Step
                icon={Layers}
                title="Create a listing"
                body="Dashboard → Collab → New listing. Set total spots and the min / max any one partner can ask for. Spots can never be oversold: every grant runs in a locked transaction."
                href={dashboardHref}
                linkLabel="Open the dashboard"
              />
            </Steps>
          </Section>

          <Section id="request" icon={Send} title="2. Request spots" description="For DAOs, communities and projects looking for allocations.">
            <Steps>
              <Step icon={Layers} title="Find a listing" body="Browse the desk by chain, NFT or token, and spots left." href={href("/listings")} linkLabel="Browse listings" />
              <Step
                icon={BadgeCheck}
                title="File the fixed intake form"
                body="Every request uses the same form: community name and size, your X link (required), Discord and Telegram (optional), an optional screenshot of a raffle you've run elsewhere, and how to reach you if chosen — an X handle, Discord username, or Telegram. There's no scoring; the listing team reviews every request themselves."
              />
              <Step icon={Inbox} title="Track it" body="Your desk's Outgoing tab shows every request's status and reviewer notes, and lets you reply when they ask for more info. You can withdraw a pending request any time." />
            </Steps>
          </Section>

          <Section id="review" icon={PackageCheck} title="3. Review & deliver" description="Off-chain delivery: wallets in, CSV out.">
            <Steps>
              <Step icon={Inbox} title="Review the queue" body="Incoming requests show the community's answers and how to reach them. Approve full or partial spots, reject, waitlist, or ask a question." />
              <Step icon={Wallet} title="Partner submits wallets" body="Approved spots are reserved until the partner pastes their delivery wallets, which confirms them. You can also confirm or revoke from Allocations." />
              <Step icon={Download} title="Export and deliver" body="Allocations → Export CSV gives one row per wallet with the requester's community, contact details and timestamps. Add them to your whitelist, then mark the allocation delivered." />
            </Steps>
          </Section>

          <section id="faq" className="scroll-mt-24 space-y-3">
            <h2 className="font-display text-xl font-bold text-white">FAQ</h2>
            <Faq q="Can anyone see who requested my spots?" a="No. Requester details, contact info and wallets are visible only to your team. Public pages show listing-level numbers, and you can hide the request count too." />
            <Faq q="What stops a listing being oversold?" a="Every approval locks the listing row, re-reads the remaining spots, and grants inside one database transaction. Concurrent requests queue behind each other, so the last spot goes to exactly one team." />
            <Faq q="Can a project without an oxbot account still get whitelisted?" a="Yes. The platform admin can add a request on their behalf using the same fixed form — it's tracked with no team attached, and you coordinate delivery through the contact details they gave." />
            <Faq q="Does Collab mint or write to my whitelist contract?" a="No. Delivery is off-chain: partners submit wallets, you export the CSV and add them to whatever whitelist tooling you use." />
          </section>

          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/40 p-5 text-sm text-muted-foreground">
            <Lock className="h-5 w-5 shrink-0 text-scarlet-soft" />
            <p>
              Every Collab action is permission-checked against your project role and recorded in your team&apos;s activity log.
            </p>
          </div>
        </div>
      </div>
    </main>
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

function Step({
  icon: Icon,
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
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-card/60">
        <Icon className="h-4 w-4 text-scarlet-soft" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        {href && (
          <Link href={href} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-scarlet-soft hover:text-white">
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

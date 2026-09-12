import Link from "next/link";
import { ArrowRight, Handshake, Layers, ShieldCheck, Ticket } from "lucide-react";

import { brandCollab } from "@/lib/brand-collab";
import { auth } from "@/lib/auth";
import { joinCollabPath } from "@/lib/collab/host";
import { getCollabSurface, mainSiteHref } from "@/lib/collab/surface";
import { getPrimaryTeamSlug } from "@/server/queries/teams";
import { Button } from "@/components/ui/button";
import { CollabHowItWorks } from "@/components/collab/collab-how-it-works";

/**
 * OxFoxes Collab landing — hero, live signal, listings, how it works, public
 * raffles. Rendered at `/collab` (or `/` on the Collab host).
 */
export default async function CollabLandingPage() {
  const [session, surface] = await Promise.all([auth(), getCollabSurface()]);
  const userId = session?.user?.id;
  const primaryTeamSlug = userId ? await getPrimaryTeamSlug(userId) : null;
  const href = (p: string) => joinCollabPath(surface.base, p);

  const deskCta = !userId
    ? { href: await mainSiteHref(`/signin?callbackUrl=${encodeURIComponent("/dashboard")}`), label: "Open a desk" }
    : primaryTeamSlug
      ? { href: await mainSiteHref(`/dashboard/${primaryTeamSlug}/collab`), label: "Open your desk" }
      : { href: await mainSiteHref("/dashboard/new"), label: "Create a project" };

  return (
    <main>
      <Hero browseHref={href("/listings")} deskCta={deskCta} />
      <div className="container">
        <div className="divider-glow" />
      </div>
      <CollabHowItWorks guideHref={href("/guide")} />
    </main>
  );
}

function Hero({
  browseHref,
  deskCta,
}: {
  browseHref: string;
  deskCta: { href: string; label: string };
}) {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid-red mask-fade-bottom opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-hero-radial" />

      <div className="container relative grid gap-16 py-24 sm:py-28 lg:grid-cols-2 lg:items-center lg:py-32">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-scarlet-soft">
            Whitelists <span className="text-muted-foreground/50">·</span> Partnerships{" "}
            <span className="text-muted-foreground/50">·</span> Raffles
          </p>
          <h1 className="mt-5 font-display text-5xl font-black leading-[1.03] tracking-tight text-white sm:text-6xl md:text-7xl">
            Whitelist partnerships.{" "}
            <span className="text-gradient-crimson">Without the Telegram chaos.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Projects allocate spots. DAOs and communities request them. Public raffles fill the rest.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={browseHref}>
                Browse listings
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={deskCta.href}>{deskCta.label}</Link>
            </Button>
          </div>

          <div className="mt-14 grid max-w-lg grid-cols-1 gap-4 sm:grid-cols-3">
            <TrustPoint icon={Layers} title="Atomic inventory" body="Never oversold." />
            <TrustPoint icon={ShieldCheck} title="Private desk" body="Applicants stay yours." />
            <TrustPoint icon={Ticket} title="Public raffles" body="Seeded, auditable." />
          </div>
        </div>

        <div className="relative hidden aspect-square items-center justify-center lg:flex">
          <div className="pointer-events-none absolute h-[26rem] w-[26rem] rounded-full bg-primary/20 blur-[100px]" />
          <div className="pointer-events-none absolute right-8 top-6 h-56 w-56 rounded-full bg-scarlet/25 blur-[80px]" />
          <div className="relative h-80 w-80">
            <div className="absolute inset-0 rounded-[2.5rem] border border-primary/25 shadow-glow-red" />
            <div className="absolute inset-6 rounded-[2rem] border border-primary/15" />
            <div className="glass-red absolute inset-12 rounded-3xl shadow-card" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="grid h-24 w-24 place-items-center rounded-3xl bg-crimson-gradient shadow-glow-red-lg">
                <Handshake className="h-10 w-10 text-white" />
              </div>
            </div>
          </div>
          <div className="glass-red absolute -bottom-4 right-0 w-64 rounded-2xl p-4 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {brandCollab.name}
            </p>
            <p className="mt-2 text-sm text-foreground/90">{brandCollab.tagline}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustPoint({ icon: Icon, title, body }: { icon: typeof Layers; title: string; body: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 text-left backdrop-blur">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10">
        <Icon className="h-5 w-5 text-scarlet-soft" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

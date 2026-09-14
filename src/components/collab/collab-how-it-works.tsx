import Link from "next/link";
import { Layers, BadgeCheck, Scale, ArrowRight } from "lucide-react";

/**
 * CollabHowItWorks — the three-step desk flow. Same section rhythm as
 * oxbot's HowItWorks.
 */
const STEPS = [
  {
    icon: Layers,
    title: "List inventory",
    body: "Post your whitelist spots — collection, chain, and how much each partner may request.",
  },
  {
    icon: BadgeCheck,
    title: "Request",
    body: "DAOs and communities file a fixed intake form: community size, socials, and how to reach them if chosen.",
  },
  {
    icon: Scale,
    title: "Distribute",
    body: "Review each request yourself, approve the spots you want to grant, and export wallets once delivery's confirmed.",
  },
] as const;

export function CollabHowItWorks({ guideHref }: { guideHref: string }) {
  return (
    <section id="how-it-works" className="container scroll-mt-24 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-scarlet-soft">How it works</p>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Whitelist deals, done in <span className="text-gradient-crimson">daylight</span>
        </h2>
        <p className="mt-4 text-muted-foreground">
          One desk for inventory, requests, and delivery. No spreadsheets passed around in DMs.
        </p>
        <Link
          href={guideHref}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-scarlet-soft hover:text-white"
        >
          Read the Collab guide <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mx-auto mt-14 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card/60 p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-glow-red"
          >
            <span className="absolute right-4 top-4 font-display text-5xl font-black text-primary/10 transition-colors group-hover:text-primary/20">
              {i + 1}
            </span>
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-crimson-gradient shadow-glow-red">
              <step.icon className="h-5 w-5 text-white" />
            </div>
            <h3 className="font-display text-lg font-semibold text-white">{step.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

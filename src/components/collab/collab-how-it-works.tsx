import Link from "next/link";
import { Layers, BadgeCheck, Scale, Zap, Dices, ListChecks, Hand, ArrowRight } from "lucide-react";

import { METHOD_META } from "@/lib/collab/constants";

/**
 * CollabHowItWorks — the three-step desk flow plus the four distribution
 * methods. Same section rhythm as oxbot's HowItWorks.
 */
const STEPS = [
  {
    icon: Layers,
    title: "List inventory",
    body: "Post your whitelist spots — collection, chain, per-partner caps, and a public raffle slice if you want one.",
  },
  {
    icon: BadgeCheck,
    title: "Request & qualify",
    body: "DAOs and communities pitch for an allocation. Your criteria score every request before you read it.",
  },
  {
    icon: Scale,
    title: "Distribute",
    body: "First come, criteria review, a seeded partner raffle, or hand-picked. Export the wallets when it's done.",
  },
] as const;

const METHODS = [
  { icon: Zap, key: "FCFS" },
  { icon: ListChecks, key: "CRITERIA" },
  { icon: Dices, key: "RAFFLE" },
  { icon: Hand, key: "MANUAL" },
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

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {METHODS.map(({ icon: Icon, key }) => (
          <div key={key} className="flex items-start gap-4 rounded-2xl border border-border/70 bg-ink-black/40 p-5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10">
              <Icon className="h-5 w-5 text-scarlet-soft" />
            </div>
            <div>
              <h4 className="font-medium text-white">{METHOD_META[key].label}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{METHOD_META[key].blurb}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

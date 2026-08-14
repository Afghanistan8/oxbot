import { ShieldCheck, Dices, Zap, KeyRound, Trophy } from "lucide-react";

/**
 * HowItWorks — marketing section explaining the founder + participant flow and
 * the platform's differentiators (privacy, provably-fair draws, three modes).
 */
const STEPS = [
  {
    icon: Trophy,
    title: "Launch a giveaway",
    body: "Register your project/community, then spin up a raffle, FCFS or a code-gated giveaway in minutes.",
  },
  {
    icon: ShieldCheck,
    title: "Set the entry tasks",
    body: "CAPTCHA, email, X follow/like/repost, Discord membership/role.",
  },
] as const;

const MODES = [
  {
    icon: Dices,
    label: "Random Raffle",
    body: "Cryptographically random winners from every completed entry.",
  },
  {
    icon: Zap,
    label: "First-Come-First-Served",
    body: "Race-safe seq ordering rewards the fastest valid entrants.",
  },
  {
    icon: KeyRound,
    label: "Code-based",
    body: "Single or multi-use codes for private, invite-only drops.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="container scroll-mt-24 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-scarlet-soft">
          How it works
        </p>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Built for teams who take their{" "}
          <span className="text-gradient-crimson">drops</span> seriously
        </h2>
        <p className="mt-4 text-muted-foreground">
          Everything you need to run a fair, private, on-brand giveaway.
        </p>
      </div>

      {/* Steps */}
      <div className="mx-auto mt-14 grid max-w-3xl gap-4 sm:grid-cols-2">
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
            <h3 className="font-display text-lg font-semibold text-white">
              {step.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>

      {/* Modes */}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {MODES.map((mode) => (
          <div
            key={mode.label}
            className="flex items-start gap-4 rounded-2xl border border-border/70 bg-ink-black/40 p-5"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/10">
              <mode.icon className="h-5 w-5 text-scarlet-soft" />
            </div>
            <div>
              <h4 className="font-medium text-white">{mode.label}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{mode.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

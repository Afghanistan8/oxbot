import { CheckCircle2, CircleDashed, ShieldCheck, UserRound, BadgeCheck } from "lucide-react";

import type { EligibilityCheck, EligibilityResult } from "@/lib/collab/eligibility";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

/**
 * EligibilityMeter — a requester's score against a listing's criteria, with
 * every check marked met / missing and where the number came from. Rendered
 * live on the request form and statically on the review desk.
 */
const SOURCE_META: Record<EligibilityCheck["source"], { label: string; icon: typeof UserRound }> = {
  "self-reported": { label: "self-reported", icon: UserRound },
  platform: { label: "verified by oxbot", icon: ShieldCheck },
  attested: { label: "attested", icon: BadgeCheck },
};

export function EligibilityMeter({
  result,
  compact = false,
  className,
}: {
  result: EligibilityResult;
  compact?: boolean;
  className?: string;
}) {
  const missing = result.checks.filter((c) => !c.met).length;
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Eligibility</p>
          <p className={cn("font-display text-2xl font-bold", result.eligible ? "text-emerald-300" : "text-amber-300")}>
            {result.score}
            <span className="text-sm font-normal text-muted-foreground"> / 100</span>
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
            result.eligible
              ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
              : "bg-amber-500/15 text-amber-300 ring-amber-500/30"
          )}
        >
          {result.checks.length === 0 ? "No criteria" : result.eligible ? "Meets criteria" : `${missing} missing`}
        </span>
      </div>
      <Progress value={result.score} />
      {!compact && result.checks.length > 0 && (
        <ul className="space-y-1.5">
          {result.checks.map((c) => {
            const Source = SOURCE_META[c.source].icon;
            return (
              <li
                key={c.key}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border px-3 py-2 text-sm",
                  c.met ? "border-emerald-500/20 bg-emerald-500/5" : "border-border bg-ink-black/30"
                )}
              >
                {c.met ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{c.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Needs {c.required} · has {c.actual}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Source className="h-3 w-3" />
                  {SOURCE_META[c.source].label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

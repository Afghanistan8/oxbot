"use client";

import { useEffect, useState } from "react";

import { msToParts } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Countdown — a live, red-accented countdown to a target date.
 *
 * Renders a compact d:h:m:s display. When the target passes it shows the
 * `endedLabel` and (optionally) calls `onComplete` once.
 */
export function Countdown({
  target,
  className,
  compact = false,
  endedLabel = "Ended",
  onComplete,
}: {
  target: Date | string;
  className?: string;
  compact?: boolean;
  endedLabel?: string;
  onComplete?: () => void;
}) {
  const targetMs =
    typeof target === "string" ? new Date(target).getTime() : target.getTime();

  // Avoid hydration mismatch: start null, compute on mount.
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    let done = false;
    const tick = () => {
      const rem = targetMs - Date.now();
      setRemaining(rem);
      if (rem <= 0 && !done) {
        done = true;
        onComplete?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs, onComplete]);

  if (remaining === null) {
    // Server + first paint placeholder.
    return (
      <div className={cn("flex gap-1.5", className)} aria-hidden>
        <TimeCell value="--" label="days" compact={compact} />
        <TimeCell value="--" label="hrs" compact={compact} />
        <TimeCell value="--" label="min" compact={compact} />
        <TimeCell value="--" label="sec" compact={compact} />
      </div>
    );
  }

  if (remaining <= 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-lg bg-muted px-2.5 py-1 text-sm font-medium text-muted-foreground",
          className
        )}
      >
        {endedLabel}
      </span>
    );
  }

  const { days, hours, minutes, seconds } = msToParts(remaining);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className={cn("flex gap-1.5", className)}>
      <TimeCell value={pad(days)} label="days" compact={compact} />
      <TimeCell value={pad(hours)} label="hrs" compact={compact} />
      <TimeCell value={pad(minutes)} label="min" compact={compact} />
      <TimeCell value={pad(seconds)} label="sec" compact={compact} pulse />
    </div>
  );
}

function TimeCell({
  value,
  label,
  compact,
  pulse = false,
}: {
  value: string;
  label: string;
  compact: boolean;
  pulse?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-border bg-ink-black/60 tabular-nums",
        compact ? "min-w-[2.5rem] px-1.5 py-1" : "min-w-[3.25rem] px-2 py-1.5"
      )}
    >
      <span
        className={cn(
          "font-display font-bold leading-none text-foreground",
          compact ? "text-base" : "text-xl",
          pulse && "text-scarlet-soft"
        )}
      >
        {value}
      </span>
      <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

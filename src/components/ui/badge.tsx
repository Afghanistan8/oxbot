import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Badge — status pills tuned to the red system, plus gold for winners and
 * semantic success/warn/live states used across giveaway cards + dashboards.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/15 text-scarlet-soft ring-1 ring-inset ring-primary/30",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        gold: "border-transparent bg-gold/15 text-gold ring-1 ring-inset ring-gold/30",
        success:
          "border-transparent bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
        warn: "border-transparent bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/30",
        danger:
          "border-transparent bg-destructive/15 text-destructive ring-1 ring-inset ring-destructive/30",
        muted: "border-transparent bg-muted text-muted-foreground",
        live: "border-transparent bg-primary/20 text-scarlet-soft ring-1 ring-inset ring-primary/40",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

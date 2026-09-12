import Link from "next/link";
import { Plus, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Dashed empty-state panel, matching the giveaway dashboard's empty states. */
export function CollabEmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/30 px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-crimson-gradient shadow-glow-red">
        <Icon className="h-6 w-6 text-white" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-white">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && (
        <Button asChild className="mt-5">
          <Link href={action.href}>
            <Plus className="h-4 w-4" />
            {action.label}
          </Link>
        </Button>
      )}
    </div>
  );
}

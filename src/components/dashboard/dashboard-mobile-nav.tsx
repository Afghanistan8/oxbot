"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";

import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Logo } from "@/components/brand/logo";
import type { TeamListItem } from "@/server/queries/teams";

/**
 * Mobile-only slide-in drawer that surfaces the dashboard navigation, which is
 * otherwise hidden below the `lg` breakpoint. Renders the exact same
 * DashboardNav as the desktop sidebar — no separate nav to keep in sync — and
 * closes itself on any route change so tapping a link feels natural on a phone.
 */
export function DashboardMobileNav({ teams }: { teams: TeamListItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Open menu"
          className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card/60 text-muted-foreground transition-colors hover:text-white lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] overflow-y-auto border-r border-border bg-background p-4 shadow-glow-red-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left lg:hidden">
          <div className="mb-6 flex items-center justify-between">
            <Logo />
            <Dialog.Close
              aria-label="Close menu"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <Dialog.Title className="sr-only">Dashboard navigation</Dialog.Title>
          <DashboardNav teams={teams} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

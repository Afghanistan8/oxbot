"use client";

import Link from "next/link";
import { Menu, Layers, Ticket, BookOpen, LayoutDashboard, Flame } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ICONS = [Layers, Ticket, BookOpen];

/**
 * Mobile-only menu for the Collab header — the desk nav hidden below `md`.
 * Links arrive pre-resolved for the current host (see CollabHeader).
 */
export function CollabHeaderMobileMenu({
  links,
  deskHref,
  oxbotHref,
}: {
  links: { href: string; label: string }[];
  deskHref: string;
  oxbotHref: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open menu"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-card/60 text-muted-foreground transition-colors hover:text-white md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {links.map((l, i) => {
          const Icon = ICONS[i] ?? Layers;
          return (
            <DropdownMenuItem key={l.href} asChild>
              <Link href={l.href}>
                <Icon className="h-4 w-4" />
                {l.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={deskHref}>
            <LayoutDashboard className="h-4 w-4" />
            Your desk
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={oxbotHref}>
            <Flame className="h-4 w-4" />
            Back to oxbot
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

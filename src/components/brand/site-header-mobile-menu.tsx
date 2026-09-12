"use client";

import Link from "next/link";
import { Menu, Compass, BookOpen, LayoutDashboard, Handshake } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Mobile-only menu for the public site header — surfaces the primary nav links
 * that are hidden below the `md` breakpoint on the desktop header.
 */
export function SiteHeaderMobileMenu({ collabHref }: { collabHref: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open menu"
          className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card/60 text-muted-foreground transition-colors hover:text-white md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem asChild>
          <Link href="/">
            <Compass className="h-4 w-4" />
            Explore
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/guide">
            <BookOpen className="h-4 w-4" />
            How it works
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutDashboard className="h-4 w-4" />
            For projects
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={collabHref}>
            <Handshake className="h-4 w-4" />
            Collab
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

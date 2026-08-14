"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import {
  LayoutDashboard,
  Gift,
  Users,
  Settings,
  Plus,
  ChevronsUpDown,
  Check,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ROLE_META } from "@/lib/constants";
import type { TeamListItem } from "@/server/queries/teams";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * DashboardNav — project switcher + section links. Highlights the active route
 * and scopes giveaway/member/settings links to the current team slug.
 */
export function DashboardNav({ teams }: { teams: TeamListItem[] }) {
  const pathname = usePathname();
  const params = useParams<{ team?: string }>();
  const activeSlug = params?.team;
  const activeTeam = teams.find((t) => t.slug === activeSlug) ?? null;

  const base = activeSlug ? `/dashboard/${activeSlug}` : "/dashboard";

  const links = activeSlug
    ? [
        { href: base, label: "Overview", icon: LayoutDashboard, exact: true },
        { href: `${base}/giveaways`, label: "Giveaways", icon: Gift },
        { href: `${base}/members`, label: "Members", icon: Users },
        { href: `${base}/settings`, label: "Settings", icon: Settings },
      ]
    : [{ href: "/dashboard", label: "All projects", icon: LayoutDashboard, exact: true }];

  return (
    <nav className="space-y-6">
      {/* Project switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-left transition-colors hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-white">
              {activeTeam?.name ?? "Select a project"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {activeTeam ? ROLE_META[activeTeam.role].label : `${teams.length} project${teams.length === 1 ? "" : "s"}`}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Projects</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {teams.map((t) => (
            <DropdownMenuItem key={t.id} asChild>
              <Link href={`/dashboard/${t.slug}`}>
                <span className="flex-1 truncate">{t.name}</span>
                {t.slug === activeSlug && <Check className="h-4 w-4 text-primary" />}
              </Link>
            </DropdownMenuItem>
          ))}
          {teams.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem asChild>
            <Link href="/dashboard/new">
              <Plus className="h-4 w-4" />
              New project
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Section links */}
      <div className="space-y-1">
        {links.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/15 text-white shadow-glow-red"
                  : "text-muted-foreground hover:bg-accent/30 hover:text-white"
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </div>

      {activeSlug && (
        <Link
          href={`${base}/giveaways/new`}
          className="flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-scarlet-soft transition-colors hover:bg-primary/20 hover:text-white"
        >
          <Plus className="h-4 w-4" />
          New giveaway
        </Link>
      )}
    </nav>
  );
}

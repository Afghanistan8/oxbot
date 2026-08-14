import Link from "next/link";

import { requireUser } from "@/lib/session";
import { getTeamsForUser } from "@/server/queries/teams";
import { Logo } from "@/components/brand/logo";
import { UserMenu } from "@/components/brand/user-menu";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { Button } from "@/components/ui/button";

/**
 * Dashboard layout — auth-gated founder shell. Redirects to sign-in when signed
 * out (via requireUser). Renders a sidebar with the project switcher + nav.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser("/dashboard");
  const teams = await getTeamsForUser(user.id);

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-ink-black/70 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="hidden rounded-md border border-border/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline">
              Studio
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/" target="_blank">
                View site
              </Link>
            </Button>
            <UserMenu
              name={user.name ?? null}
              email={user.email ?? null}
              image={user.image ?? null}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] gap-8 px-4 py-8 sm:px-6">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <DashboardNav teams={teams} />
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

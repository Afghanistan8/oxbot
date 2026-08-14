import Link from "next/link";

import { auth } from "@/lib/auth";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/brand/user-menu";

/**
 * SiteHeader — the public top navigation. Sticky, glassy, with the crimson
 * wordmark, primary nav, and either a sign-in CTA or the user menu.
 */
export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-ink-black/70 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink href="/">Explore</NavLink>
            <NavLink href="/#how-it-works">How it works</NavLink>
            <NavLink href="/dashboard">For projects</NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/dashboard/giveaways/new">Create giveaway</Link>
              </Button>
              <UserMenu
                name={user.name ?? null}
                email={user.email ?? null}
                image={user.image ?? null}
              />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/signin">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signin?callbackUrl=/dashboard">Launch a giveaway</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/40 hover:text-white"
    >
      {children}
    </Link>
  );
}

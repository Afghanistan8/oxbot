import Link from "next/link";

import { auth } from "@/lib/auth";
import { joinCollabPath } from "@/lib/collab/host";
import { collabSignInHref, getCollabSurface, mainSiteHref } from "@/lib/collab/surface";
import { getPrimaryTeamSlug } from "@/server/queries/teams";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/brand/user-menu";
import { CollabHeaderMobileMenu } from "@/components/collab/collab-header-mobile-menu";

/**
 * CollabHeader — the public top navigation on the OxFoxes Collab surface.
 * Same sticky glass chrome as oxbot's SiteHeader; Collab wordmark + desk nav.
 */
export async function CollabHeader() {
  const [session, surface] = await Promise.all([auth(), getCollabSurface()]);
  const user = session?.user;
  const primaryTeamSlug = user?.id ? await getPrimaryTeamSlug(user.id) : null;
  const href = (p: string) => joinCollabPath(surface.base, p);

  const [deskHref, signInHref, oxbotHref] = await Promise.all([
    mainSiteHref(primaryTeamSlug ? `/dashboard/${primaryTeamSlug}/collab` : "/dashboard"),
    collabSignInHref("/"),
    mainSiteHref("/"),
  ]);

  const links = [
    { href: href("/listings"), label: "Listings" },
    { href: href("/guide"), label: "How it works" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-ink-black/70 backdrop-blur-xl">
      <div className="container grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <CollabHeaderMobileMenu links={links} deskHref={deskHref} oxbotHref={oxbotHref} />
          <Logo href={href("/")} />
          <span className="hidden rounded-md border border-border/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline">
            Collab
          </span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href}>
              {l.label}
            </NavLink>
          ))}
          <NavLink href={oxbotHref}>oxbot</NavLink>
        </nav>

        <div className="flex items-center justify-end gap-2">
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href={deskHref}>{primaryTeamSlug ? "Open your desk" : "Create a project"}</Link>
              </Button>
              <UserMenu
                name={user.name ?? null}
                email={user.email ?? null}
                image={user.image ?? null}
              />
            </>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href={signInHref}>Sign in</Link>
            </Button>
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

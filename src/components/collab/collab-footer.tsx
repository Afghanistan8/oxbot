import Link from "next/link";

import { brand } from "@/lib/brand";
import { brandCollab } from "@/lib/brand-collab";
import { auth } from "@/lib/auth";
import { joinCollabPath } from "@/lib/collab/host";
import { getCollabSurface, mainSiteHref } from "@/lib/collab/surface";
import { getPrimaryTeamSlug } from "@/server/queries/teams";
import { Logo } from "@/components/brand/logo";

/**
 * CollabFooter — oxbot's footer chrome with the Collab brand and desk links,
 * plus a way back to the parent product.
 */
export async function CollabFooter() {
  const [session, surface] = await Promise.all([auth(), getCollabSurface()]);
  const userId = session?.user?.id;
  const primaryTeamSlug = userId ? await getPrimaryTeamSlug(userId) : null;
  const href = (p: string) => joinCollabPath(surface.base, p);

  const [oxbotHome, deskHref, newListingHref, signInHref, profileHref] = await Promise.all([
    mainSiteHref("/"),
    mainSiteHref(primaryTeamSlug ? `/dashboard/${primaryTeamSlug}/collab` : "/dashboard"),
    primaryTeamSlug ? mainSiteHref(`/dashboard/${primaryTeamSlug}/collab/listings/new`) : null,
    mainSiteHref("/signin"),
    mainSiteHref("/profile"),
  ]);

  return (
    <footer className="mt-24 border-t border-border/60 bg-ink-black/40">
      <div className="container py-12">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-xs space-y-3">
            <div className="flex items-center gap-3">
              <Logo href={href("/")} />
              <span className="rounded-md border border-border/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Collab
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{brandCollab.tagline}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <FooterCol title="Desk">
              <FooterLink href={href("/listings")}>Browse listings</FooterLink>
              <FooterLink href={href("/raffles")}>Public raffles</FooterLink>
              <FooterLink href={href("/guide")}>How it works</FooterLink>
              <FooterLink href={deskHref}>Your desk</FooterLink>
              {newListingHref && <FooterLink href={newListingHref}>List inventory</FooterLink>}
            </FooterCol>
            <FooterCol title="Account">
              <FooterLink href={signInHref}>Sign in</FooterLink>
              <FooterLink href={profileHref}>Profile</FooterLink>
            </FooterCol>
            <FooterCol title={brand.name}>
              <FooterLink href={oxbotHome}>Explore giveaways</FooterLink>
              <FooterLink href={oxbotHome}>{brandCollab.parentDomain}</FooterLink>
            </FooterCol>
          </div>
        </div>

        <div className="my-8 divider-glow" />

        <div className="flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {brandCollab.name}. All rights reserved.
          </p>
          <p>
            A desk by <span className="text-scarlet-soft">{brand.name}</span> — whitelist deals, done in daylight.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/70">{title}</h4>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-sm text-muted-foreground transition-colors hover:text-scarlet-soft">
        {children}
      </Link>
    </li>
  );
}

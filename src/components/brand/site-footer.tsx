import Link from "next/link";

import { brand } from "@/lib/brand";
import { auth } from "@/lib/auth";
import { getPrimaryTeamSlug } from "@/server/queries/teams";
import { Logo } from "@/components/brand/logo";

/**
 * SiteFooter — brand mark, quick links, and a crimson divider.
 */
export async function SiteFooter() {
  const session = await auth();
  const userId = session?.user?.id;
  const primaryTeamSlug = userId ? await getPrimaryTeamSlug(userId) : null;

  return (
    <footer className="mt-24 border-t border-border/60 bg-ink-black/40">
      <div className="container py-12">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-xs space-y-3">
            <Logo />
            <p className="text-sm text-muted-foreground">{brand.tagline}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <FooterCol title="Platform">
              <FooterLink href="/">Explore giveaways</FooterLink>
              <FooterLink href="/guide">How to use</FooterLink>
              <FooterLink href="/dashboard">Project dashboard</FooterLink>
              {primaryTeamSlug && (
                <FooterLink href={`/dashboard/${primaryTeamSlug}/giveaways/new`}>
                  Create giveaway
                </FooterLink>
              )}
            </FooterCol>
            <FooterCol title="Account">
              <FooterLink href="/signin">Sign in</FooterLink>
              <FooterLink href="/profile">Profile</FooterLink>
            </FooterCol>
            <FooterCol title="Legal">
              <FooterLink href="/terms">Terms</FooterLink>
              <FooterLink href="/privacy">Privacy</FooterLink>
            </FooterCol>
          </div>
        </div>

        <div className="my-8 divider-glow" />

        <div className="flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {brand.name}. All rights reserved.
          </p>
          <p>
            Built with a fierce, elegant{" "}
            <span className="text-scarlet-soft">red</span> soul.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
        {title}
      </h4>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-muted-foreground transition-colors hover:text-scarlet-soft"
      >
        {children}
      </Link>
    </li>
  );
}

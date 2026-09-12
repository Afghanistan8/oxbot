import type { Metadata } from "next";

import { brandCollab } from "@/lib/brand-collab";
import { absoluteUrl } from "@/lib/utils";
import { CollabHeader } from "@/components/collab/collab-header";
import { CollabFooter } from "@/components/collab/collab-footer";

/**
 * OxFoxes Collab surface layout. Shares the root layout (fonts, grain, toasts,
 * providers) and swaps only the brand chrome. Reached at `/collab/*`, or at `/`
 * on the Collab host via middleware rewrite.
 */
export const metadata: Metadata = {
  title: {
    // `absolute` so the root layout's "%s · oxbot" template doesn't apply here.
    absolute: `${brandCollab.name} — Whitelist partnerships`,
    template: `%s · ${brandCollab.name}`,
  },
  description: brandCollab.description,
  applicationName: brandCollab.name,
  openGraph: {
    title: `${brandCollab.name} — Whitelist partnerships`,
    description: brandCollab.description,
    siteName: brandCollab.name,
    type: "website",
    images: [{ url: absoluteUrl("/og-default.jpg"), width: 1200, height: 630, alt: brandCollab.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${brandCollab.name} — Whitelist partnerships`,
    description: brandCollab.description,
  },
};

// Every Collab page reads the request host (link bases) and live inventory.
export const dynamic = "force-dynamic";

export default function CollabLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CollabHeader />
      {children}
      <CollabFooter />
    </>
  );
}

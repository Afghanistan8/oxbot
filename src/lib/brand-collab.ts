/**
 * Brand identity for OxFoxes Collab — the whitelist partnership desk that runs
 * on the collab subdomain on top of the oxbot giveaway engine.
 *
 * Mirrors `brand.ts`: the product is named in ONE place. Everything Collab-
 * facing (header, footer, metadata, emails, webhook embeds) reads from here.
 */
export const brandCollab = {
  /** Product name shown across the Collab surface. */
  name: "OxFoxes Collab",
  /** Short label for nav links and chips. */
  short: "Collab",
  /** Hero + metadata tagline. */
  tagline: "The whitelist partnership desk for NFT and token projects.",
  /** One-line description for SEO / social cards. */
  description:
    "Projects allocate whitelist spots. DAOs and communities request them. Public raffles fill the rest.",
  /** Public host. The app serves Collab here via middleware host detection. */
  domain: "collab.oxbotfoxes.xyz",
  /** The parent product's public host (for "back to oxbot" links). */
  parentDomain: "oxbotfoxes.xyz",
} as const;

export type BrandCollab = typeof brandCollab;

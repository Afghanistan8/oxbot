/**
 * Single source of truth for the oxbot brand identity.
 *
 * The product is intentionally named in ONE place so it can be rebranded instantly
 * (e.g. to "CrimsonRaffle") by editing this file alone — nothing else hardcodes the name.
 */
export const brand = {
  /** Product name shown across the UI, emails, and metadata. */
  name: "oxbot",
  /** Short tagline used in the hero + metadata. */
  tagline: "A premium Web3 giveaway platform with a fierce, elegant red soul.",
  /** One-line description for SEO / social cards. */
  description:
    "Run stunning crypto & NFT giveaways. Random raffles, first-come-first-served, and code-based drops.",
  /** Domain used for canonical URLs and default email sender label. */
  domain: "oxbot.app",
  /** Support / contact address label (display only). */
  contactEmail: "hello@oxbot.app",
  /** Social handles (display only; used in the footer). */
  socials: {
    x: "https://x.com",
    discord: "https://discord.com",
    github: "https://github.com",
  },
} as const;

export type Brand = typeof brand;

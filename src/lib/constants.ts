import type {
  Blockchain,
  GiveawayType,
  GiveawayVisibility,
  RequirementType,
  TeamRole,
} from "@prisma/client";

/**
 * Shared domain constants + display metadata.
 *
 * Central place for chain labels, giveaway-type copy, requirement descriptions,
 * and role hierarchy — consumed by both the UI and the seed script.
 */

// --- Blockchains -----------------------------------------------------------

export const CHAIN_META: Record<
  Blockchain,
  { label: string; short: string; color: string; tokenSymbol: string }
> = {
  ETHEREUM: { label: "Ethereum", short: "ETH", color: "#627EEA", tokenSymbol: "ETH" },
  SOLANA: { label: "Solana", short: "SOL", color: "#14F195", tokenSymbol: "SOL" },
  ROBINHOOD: { label: "Robinhood Chain", short: "RHC", color: "#00C805", tokenSymbol: "RHC" },
  ARBITRUM: { label: "Arbitrum", short: "ARB", color: "#28A0F0", tokenSymbol: "ETH" },
  BASE: { label: "Base", short: "BASE", color: "#0052FF", tokenSymbol: "ETH" },
  BITCOIN: { label: "Bitcoin (Ordinals)", short: "BTC", color: "#F7931A", tokenSymbol: "BTC" },
  SUI: { label: "Sui", short: "SUI", color: "#4DA2FF", tokenSymbol: "SUI" },
  POLYGON: { label: "Polygon", short: "POLY", color: "#8247E5", tokenSymbol: "MATIC" },
  OTHER: { label: "Other", short: "—", color: "#9CA3AF", tokenSymbol: "" },
};

export const ALL_CHAINS: Blockchain[] = [
  "ETHEREUM",
  "SOLANA",
  "ROBINHOOD",
  "ARBITRUM",
  "BASE",
  "BITCOIN",
  "SUI",
  "POLYGON",
  "OTHER",
];

// --- Giveaway types --------------------------------------------------------

export const GIVEAWAY_TYPE_META: Record<
  GiveawayType,
  { label: string; blurb: string }
> = {
  RANDOM: {
    label: "Random Raffle",
    blurb: "Winners are chosen at random from all completed entries at the end.",
  },
  FCFS: {
    label: "First-Come-First-Served",
    blurb: "The first valid entries to complete all tasks win, in order.",
  },
  CODE: {
    label: "Code-based",
    blurb: "Entry requires a valid code — ideal for private, invite-only drops.",
  },
};

export const GIVEAWAY_VISIBILITY_META: Record<
  GiveawayVisibility,
  { label: string; blurb: string }
> = {
  PUBLIC: { label: "Public", blurb: "Listed publicly; anyone can view and enter." },
  COMMUNITY: {
    label: "Community-only",
    blurb: "Gated to a linked Discord/Telegram community.",
  },
  PRIVATE: {
    label: "Private",
    blurb: "Hidden from listings; entered via a shared code or link.",
  },
};

// --- Requirements ----------------------------------------------------------

export const REQUIREMENT_META: Record<
  RequirementType,
  { label: string; short: string; icon: string; description: string }
> = {
  CAPTCHA: {
    label: "Human verification",
    short: "CAPTCHA",
    icon: "shield-check",
    description: "Complete a CAPTCHA to prove you're human.",
  },
  EMAIL: {
    label: "Verify email",
    short: "Email",
    icon: "mail",
    description: "Confirm a valid email address.",
  },
  CODE: {
    label: "Entry code",
    short: "Code",
    icon: "key-round",
    description: "Enter a valid access code.",
  },
  TWITTER_FOLLOW: {
    label: "Follow on X",
    short: "Follow",
    icon: "twitter",
    description: "Follow the project's X (Twitter) account.",
  },
  TWITTER_LIKE: {
    label: "Like a post",
    short: "Like",
    icon: "heart",
    description: "Like a specific X post.",
  },
  TWITTER_RETWEET: {
    label: "Repost",
    short: "Repost",
    icon: "repeat",
    description: "Repost a specific X post.",
  },
  DISCORD_MEMBER: {
    label: "Join Discord",
    short: "Discord",
    icon: "message-circle",
    description: "Be a member of the project's Discord server.",
  },
  DISCORD_ROLE: {
    label: "Hold a Discord role",
    short: "Role",
    icon: "shield",
    description: "Hold a required role in the Discord server.",
  },
  WALLET: {
    label: "Connect wallet",
    short: "Wallet",
    icon: "wallet",
    description: "Connect a wallet on the selected chain.",
  },
};

/** Requirement types that involve X (Twitter). */
export const TWITTER_REQUIREMENTS: RequirementType[] = [
  "TWITTER_FOLLOW",
  "TWITTER_LIKE",
  "TWITTER_RETWEET",
];

/** Requirement types that involve Discord. */
export const DISCORD_REQUIREMENTS: RequirementType[] = [
  "DISCORD_MEMBER",
  "DISCORD_ROLE",
];

// --- Roles -----------------------------------------------------------------

export const ROLE_RANK: Record<TeamRole, number> = {
  OWNER: 3,
  ADMIN: 2,
  EDITOR: 1,
};

export const ROLE_META: Record<TeamRole, { label: string; blurb: string }> = {
  OWNER: { label: "Owner", blurb: "Full control, including billing and deletion." },
  ADMIN: { label: "Admin", blurb: "Manage giveaways, members, and settings." },
  EDITOR: {
    label: "Raffle Manager",
    blurb: "Can run giveaways on the project's behalf, without full admin access.",
  },
};

/** Does `role` meet or exceed `required`? */
export function roleAtLeast(role: TeamRole, required: TeamRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

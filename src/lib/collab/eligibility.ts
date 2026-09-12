import type { AssetType, Blockchain } from "@prisma/client";

/**
 * Collab eligibility engine — PURE (no DB, no network, no clock).
 *
 * Scores a requester team against a listing's criteria. The same function
 * drives the live "eligibility meter" on the request form (client), the
 * authoritative check inside the submit action (server), and the seed script,
 * so what a requester sees is exactly what the listing team gets.
 *
 * Facts come from two places:
 *  - self-reported by the requester (community size, holders, followers,
 *    Discord members, chains, asset type) — flagged as such to reviewers;
 *  - computed by the platform (completed oxbot raffle entries, verified team).
 */

export type CustomRule = { id: string; label: string };

export type CriteriaInput = {
  minCommunitySize: number | null;
  minHolderCount: number | null;
  minTwitterFollowers: number | null;
  minDiscordMembers: number | null;
  minRaffleEntries: number | null;
  requiredChains: Blockchain[];
  requiredAssetType: AssetType | null;
  requireVerifiedTeam: boolean;
  customRules: CustomRule[];
};

export type RequesterFacts = {
  communitySize: number | null;
  holderCount: number | null;
  twitterFollowers: number | null;
  discordMembers: number | null;
  /** Completed entries across the requester team's oxbot giveaways. */
  raffleEntries: number;
  chains: Blockchain[];
  assetType: AssetType | null;
  verifiedTeam: boolean;
  /** customRule.id → attested by the requester. */
  attestations: Record<string, boolean>;
};

export type EligibilityCheck = {
  key: string;
  label: string;
  met: boolean;
  /** Human threshold, e.g. "≥ 5,000". */
  required: string;
  /** Human actual value, e.g. "3,200" or "not provided". */
  actual: string;
  source: "self-reported" | "platform" | "attested";
};

export type EligibilityResult = {
  eligible: boolean;
  /** 0–100: share of checks met. 100 when the listing has no criteria. */
  score: number;
  checks: EligibilityCheck[];
};

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

function minCheck(
  key: string,
  label: string,
  min: number | null,
  actual: number | null,
  source: EligibilityCheck["source"]
): EligibilityCheck | null {
  if (min === null || min <= 0) return null;
  return {
    key,
    label,
    met: actual !== null && actual >= min,
    required: `≥ ${fmt(min)}`,
    actual: actual === null ? "not provided" : fmt(actual),
    source,
  };
}

export function evaluateEligibility(
  criteria: CriteriaInput | null,
  facts: RequesterFacts
): EligibilityResult {
  if (!criteria) return { eligible: true, score: 100, checks: [] };

  const checks: EligibilityCheck[] = [];
  const push = (c: EligibilityCheck | null) => {
    if (c) checks.push(c);
  };

  push(minCheck("communitySize", "Community size", criteria.minCommunitySize, facts.communitySize, "self-reported"));
  push(minCheck("holderCount", "Holders", criteria.minHolderCount, facts.holderCount, "self-reported"));
  push(minCheck("twitterFollowers", "X followers", criteria.minTwitterFollowers, facts.twitterFollowers, "self-reported"));
  push(minCheck("discordMembers", "Discord members", criteria.minDiscordMembers, facts.discordMembers, "self-reported"));
  push(minCheck("raffleEntries", "oxbot raffle entries", criteria.minRaffleEntries, facts.raffleEntries, "platform"));

  if (criteria.requiredChains.length > 0) {
    const overlap = criteria.requiredChains.filter((c) => facts.chains.includes(c));
    checks.push({
      key: "chains",
      label: "Chain",
      met: overlap.length > 0,
      required: criteria.requiredChains.join(" / "),
      actual: facts.chains.length ? facts.chains.join(", ") : "not provided",
      source: "self-reported",
    });
  }

  if (criteria.requiredAssetType) {
    checks.push({
      key: "assetType",
      label: "Project type",
      met: facts.assetType === criteria.requiredAssetType,
      required: criteria.requiredAssetType,
      actual: facts.assetType ?? "not provided",
      source: "self-reported",
    });
  }

  if (criteria.requireVerifiedTeam) {
    checks.push({
      key: "verifiedTeam",
      label: "Verified project",
      met: facts.verifiedTeam,
      required: "Logo, socials & a published drop",
      actual: facts.verifiedTeam ? "verified" : "incomplete profile",
      source: "platform",
    });
  }

  for (const rule of criteria.customRules) {
    checks.push({
      key: `rule:${rule.id}`,
      label: rule.label,
      met: facts.attestations[rule.id] === true,
      required: "Attest",
      actual: facts.attestations[rule.id] ? "attested" : "not attested",
      source: "attested",
    });
  }

  const met = checks.filter((c) => c.met).length;
  return {
    eligible: met === checks.length,
    score: checks.length === 0 ? 100 : Math.round((met / checks.length) * 100),
    checks,
  };
}

/**
 * "Verified project" = has a logo, at least one social (X or Discord), and has
 * published at least one giveaway or listing on oxbot.
 */
export function isVerifiedTeam(t: {
  logoUrl: string | null;
  xHandle: string | null;
  discordInvite: string | null;
  publishedGiveaways: number;
  publishedListings: number;
}): boolean {
  return (
    Boolean(t.logoUrl) &&
    Boolean(t.xHandle || t.discordInvite) &&
    t.publishedGiveaways + t.publishedListings > 0
  );
}

/** Defensive parse of the `customRules` JSON column. */
export function parseCustomRules(raw: unknown): CustomRule[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { id, label } = item as Record<string, unknown>;
    if (typeof id === "string" && typeof label === "string" && label.trim()) {
      out.push({ id, label: label.trim() });
    }
  }
  return out;
}

/** Defensive parse of a request's `evidence` JSON column. */
export function parseEvidence(raw: unknown): { links: string[]; attestations: Record<string, boolean> } {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const links = Array.isArray(obj.links) ? obj.links.filter((l): l is string => typeof l === "string") : [];
  const attestations: Record<string, boolean> = {};
  if (obj.attestations && typeof obj.attestations === "object") {
    for (const [k, v] of Object.entries(obj.attestations as Record<string, unknown>)) {
      if (v === true) attestations[k] = true;
    }
  }
  return { links, attestations };
}

/** Map a DB criteria row (or null) to the engine's input shape. */
export function criteriaFromRow(
  row: {
    minCommunitySize: number | null;
    minHolderCount: number | null;
    minTwitterFollowers: number | null;
    minDiscordMembers: number | null;
    minRaffleEntries: number | null;
    requiredChains: Blockchain[];
    requiredAssetType: AssetType | null;
    requireVerifiedTeam: boolean;
    customRules: unknown;
  } | null
): CriteriaInput | null {
  if (!row) return null;
  return {
    minCommunitySize: row.minCommunitySize,
    minHolderCount: row.minHolderCount,
    minTwitterFollowers: row.minTwitterFollowers,
    minDiscordMembers: row.minDiscordMembers,
    minRaffleEntries: row.minRaffleEntries,
    requiredChains: row.requiredChains,
    requiredAssetType: row.requiredAssetType,
    requireVerifiedTeam: row.requireVerifiedTeam,
    customRules: parseCustomRules(row.customRules),
  };
}

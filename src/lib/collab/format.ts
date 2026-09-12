import { CHAIN_META } from "@/lib/constants";
import { ASSET_TYPE_META } from "@/lib/collab/constants";
import type { CriteriaInput } from "@/lib/collab/eligibility";

/** Human one-liner of a criteria set, for template lists and listing cards. */
export function summarizeCriteria(c: CriteriaInput | null): string {
  if (!c) return "Open to everyone";
  const f = (v: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(v);
  const parts: string[] = [];
  if (c.minCommunitySize) parts.push(`${f(c.minCommunitySize)}+ community`);
  if (c.minTwitterFollowers) parts.push(`${f(c.minTwitterFollowers)}+ X`);
  if (c.minDiscordMembers) parts.push(`${f(c.minDiscordMembers)}+ Discord`);
  if (c.minHolderCount) parts.push(`${f(c.minHolderCount)}+ holders`);
  if (c.minRaffleEntries) parts.push(`${f(c.minRaffleEntries)}+ oxbot entries`);
  if (c.requiredChains.length) parts.push(c.requiredChains.map((ch) => CHAIN_META[ch].short).join("/"));
  if (c.requiredAssetType) parts.push(ASSET_TYPE_META[c.requiredAssetType].label);
  if (c.requireVerifiedTeam) parts.push("verified");
  if (c.customRules.length) parts.push(`${c.customRules.length} custom rule${c.customRules.length === 1 ? "" : "s"}`);
  return parts.length ? parts.join(" · ") : "Open to everyone";
}

/** Criteria as a list of display rows ("Community size", "≥ 5,000"). */
export function criteriaRows(c: CriteriaInput | null): { label: string; value: string }[] {
  if (!c) return [];
  const n = (v: number) => `≥ ${new Intl.NumberFormat("en-US").format(v)}`;
  const rows: { label: string; value: string }[] = [];
  if (c.minCommunitySize) rows.push({ label: "Community size", value: n(c.minCommunitySize) });
  if (c.minTwitterFollowers) rows.push({ label: "X followers", value: n(c.minTwitterFollowers) });
  if (c.minDiscordMembers) rows.push({ label: "Discord members", value: n(c.minDiscordMembers) });
  if (c.minHolderCount) rows.push({ label: "Holders", value: n(c.minHolderCount) });
  if (c.minRaffleEntries) rows.push({ label: "oxbot raffle entries", value: n(c.minRaffleEntries) });
  if (c.requiredChains.length) {
    rows.push({ label: "Chain", value: c.requiredChains.map((ch) => CHAIN_META[ch].label).join(" or ") });
  }
  if (c.requiredAssetType) rows.push({ label: "Project type", value: ASSET_TYPE_META[c.requiredAssetType].label });
  if (c.requireVerifiedTeam) rows.push({ label: "Verified project", value: "Required" });
  for (const r of c.customRules) rows.push({ label: r.label, value: "Attest" });
  return rows;
}

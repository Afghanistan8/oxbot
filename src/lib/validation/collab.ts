import { z } from "zod";

import { ALL_CHAINS } from "@/lib/constants";
import type { AssetType, Blockchain, DistributionMethod } from "@prisma/client";

/**
 * Zod schemas for every OxFoxes Collab mutation — listings, criteria,
 * templates, partner requests, reviews and allocations. Shared by the server
 * actions (authoritative) and forms (hints).
 */

export const chainEnum = z.enum(ALL_CHAINS as [Blockchain, ...Blockchain[]]);
export const assetTypeEnum = z.enum(["NFT", "TOKEN", "OTHER"] as [AssetType, ...AssetType[]]);
export const methodEnum = z.enum(["FCFS", "CRITERIA", "RAFFLE", "MANUAL"] as [
  DistributionMethod,
  ...DistributionMethod[],
]);
const visibilityEnum = z.enum(["PUBLIC", "COMMUNITY", "PRIVATE"]);

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalUrl = z.string().trim().url("Enter a valid URL.").max(300).optional().or(z.literal(""));

/** A non-negative whole-number threshold; null / blank = not required. */
const threshold = z
  .union([z.number(), z.string(), z.null()])
  .transform((v, ctx) => {
    if (v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000_000) {
      ctx.addIssue({ code: "custom", message: "Enter a whole number, or leave blank." });
      return z.NEVER;
    }
    return n === 0 ? null : n;
  });

/** Optional date from a form field ("" → undefined). */
const optionalDate = z
  .union([z.string(), z.date(), z.undefined(), z.null()])
  .transform((v, ctx) => {
    if (v === undefined || v === null || v === "") return undefined;
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." });
      return z.NEVER;
    }
    return d;
  });

// --- Criteria ---------------------------------------------------------------

export const customRuleSchema = z.object({
  id: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
  label: z.string().trim().min(2, "Describe the rule.").max(140),
});

export const criteriaSchema = z.object({
  minCommunitySize: threshold.default(null),
  minHolderCount: threshold.default(null),
  minTwitterFollowers: threshold.default(null),
  minDiscordMembers: threshold.default(null),
  minRaffleEntries: threshold.default(null),
  requiredChains: z.array(chainEnum).max(ALL_CHAINS.length).default([]),
  requiredAssetType: assetTypeEnum.nullable().default(null),
  requireVerifiedTeam: z.boolean().default(false),
  customRules: z.array(customRuleSchema).max(10, "Up to 10 custom rules.").default([]),
});

export type CriteriaFormInput = z.infer<typeof criteriaSchema>;

export const criteriaTemplateSchema = z.object({
  name: z.string().trim().min(2, "Name the template.").max(60),
  criteria: criteriaSchema,
});

// --- Listing ----------------------------------------------------------------

const spots = (label: string, min: number) =>
  z.coerce
    .number({ message: `Enter ${label}.` })
    .int("Whole numbers only.")
    .min(min, `${label[0]!.toUpperCase()}${label.slice(1)} must be at least ${min}.`)
    .max(100_000);

export const listingFormSchema = z
  .object({
    title: z.string().trim().min(3, "Title is too short.").max(120),
    description: optionalText(4000),
    bannerUrl: optionalUrl,
    assetType: assetTypeEnum,
    chain: chainEnum,
    collectionName: optionalText(120),
    collectionAddress: optionalText(120),
    tokenSymbol: optionalText(20),
    tokenAddress: optionalText(120),
    mintOrTgeAt: optionalDate,
    totalSpots: spots("total spots", 1),
    publicSpots: spots("public spots", 0),
    spotsPerRequestMin: spots("the minimum per partner", 1),
    spotsPerRequestMax: spots("the maximum per partner", 1),
    distributionMethod: methodEnum,
    visibility: visibilityEnum,
    startAt: z.coerce.date({ message: "Pick a start time." }),
    endAt: z.coerce.date({ message: "Pick an end time." }),
    hideRequestCount: z.boolean().default(false),
    notesPrivate: optionalText(4000),
    criteria: criteriaSchema,
  })
  .refine((d) => d.endAt.getTime() > d.startAt.getTime(), {
    message: "The window must end after it starts.",
    path: ["endAt"],
  })
  .refine((d) => d.publicSpots <= d.totalSpots, {
    message: "Public spots can't exceed total spots.",
    path: ["publicSpots"],
  })
  .refine((d) => d.spotsPerRequestMin <= d.spotsPerRequestMax, {
    message: "Minimum can't be above the maximum.",
    path: ["spotsPerRequestMin"],
  })
  .refine((d) => d.publicSpots === d.totalSpots || d.spotsPerRequestMin <= d.totalSpots - d.publicSpots, {
    message: "The per-partner minimum is larger than the partner inventory.",
    path: ["spotsPerRequestMin"],
  });

export type ListingFormInput = z.infer<typeof listingFormSchema>;

// --- Partner request --------------------------------------------------------

const optionalCount = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v, ctx) => {
    if (v === undefined || v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s]/g, ""));
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000_000) {
      ctx.addIssue({ code: "custom", message: "Enter a whole number." });
      return z.NEVER;
    }
    return n;
  });

export const requestFormSchema = z.object({
  requesterTeamId: z.string().trim().min(1, "Pick which project is requesting."),
  spotsRequested: z.coerce.number().int("Whole numbers only.").min(1, "Request at least 1 spot.").max(100_000),
  pitch: z.string().trim().min(20, "Tell them why — at least a couple of sentences.").max(4000),
  audienceSummary: optionalText(2000),
  communitySize: optionalCount,
  holderCount: optionalCount,
  twitterFollowers: optionalCount,
  discordMembers: optionalCount,
  requesterChains: z.array(chainEnum).max(ALL_CHAINS.length).default([]),
  requesterAssetType: assetTypeEnum.nullable().default(null),
  evidenceLinks: z.array(z.string().trim().url("Evidence links must be URLs.").max(300)).max(8).default([]),
  attestations: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  walletForDelivery: optionalText(120),
  deliveryChain: chainEnum.optional().or(z.literal("")),
});

export type RequestFormInput = z.infer<typeof requestFormSchema>;

// --- Review -----------------------------------------------------------------

export const reviewDecisionSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approve"),
    spotsGranted: z.coerce.number().int().min(1, "Grant at least 1 spot.").max(100_000),
    note: optionalText(2000),
  }),
  z.object({ decision: z.literal("reject"), note: optionalText(2000) }),
  z.object({
    decision: z.literal("needs_info"),
    note: z.string().trim().min(5, "Say what you need from them.").max(2000),
  }),
  z.object({ decision: z.literal("waitlist"), note: optionalText(2000) }),
]);

export type ReviewDecisionInput = z.infer<typeof reviewDecisionSchema>;

export const requesterReplySchema = z.object({
  reply: z.string().trim().min(5, "Add a short reply.").max(2000),
});

// --- Allocation delivery ----------------------------------------------------

export const allocationWalletSchema = z.object({
  address: z.string().trim().min(8, "That doesn't look like a wallet address.").max(120),
  chain: chainEnum,
  label: optionalText(60),
});

export const allocationWalletsSchema = z.object({
  wallets: z.array(allocationWalletSchema).min(1, "Add at least one wallet.").max(10_000),
});

/**
 * Parse a pasted wallet list — one per line, optional "address, label".
 * Duplicates (case-insensitive) collapse to one.
 */
export function parseWalletLines(raw: string, chain: Blockchain) {
  const seen = new Set<string>();
  const out: { address: string; chain: Blockchain; label: string }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const [addr, ...rest] = line.split(",");
    const address = (addr ?? "").trim();
    if (!address) continue;
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ address, chain, label: rest.join(",").trim() });
  }
  return out;
}

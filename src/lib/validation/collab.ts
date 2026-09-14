import { z } from "zod";

import { ALL_CHAINS } from "@/lib/constants";
import { cleanHandle, normalizeCommunityLink, type CommunityPlatform } from "@/lib/collab/socials";
import type { AssetType, Blockchain, ContactMethod } from "@prisma/client";

/**
 * Zod schemas for every OxFoxes Collab mutation — listings, partner requests,
 * reviews and allocations. Shared by the server actions (authoritative) and
 * forms (hints).
 */

export const chainEnum = z.enum(ALL_CHAINS as [Blockchain, ...Blockchain[]]);
export const assetTypeEnum = z.enum(["NFT", "TOKEN", "OTHER"] as [AssetType, ...AssetType[]]);
export const contactMethodEnum = z.enum(["X", "DISCORD", "TELEGRAM"] as [
  ContactMethod,
  ...ContactMethod[],
]);
const visibilityEnum = z.enum(["PUBLIC", "COMMUNITY", "PRIVATE"]);

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalUrl = z.string().trim().url("Enter a valid URL.").max(300).optional().or(z.literal(""));

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
    spotsPerRequestMin: spots("the minimum per partner", 1),
    spotsPerRequestMax: spots("the maximum per partner", 1),
    visibility: visibilityEnum,
    startAt: z.coerce.date({ message: "Pick a start time." }),
    endAt: z.coerce.date({ message: "Pick an end time." }),
    hideRequestCount: z.boolean().default(false),
    notesPrivate: optionalText(4000),
  })
  .refine((d) => d.endAt.getTime() > d.startAt.getTime(), {
    message: "The window must end after it starts.",
    path: ["endAt"],
  })
  .refine((d) => d.spotsPerRequestMin <= d.spotsPerRequestMax, {
    message: "Minimum can't be above the maximum.",
    path: ["spotsPerRequestMin"],
  })
  .refine((d) => d.spotsPerRequestMin <= d.totalSpots, {
    message: "The per-partner minimum is larger than total spots.",
    path: ["spotsPerRequestMin"],
  });

export type ListingFormInput = z.infer<typeof listingFormSchema>;

// --- Partner request ---------------------------------------------------------
//
// The intake form is fixed — every request carries the same fields, whether
// filed by a requester or added on their behalf by a platform admin.

const requiredCount = (message: string) =>
  z.union([z.string(), z.number()]).transform((v, ctx) => {
    const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s]/g, ""));
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000_000) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return n;
  });

const communityLink = (platform: CommunityPlatform) =>
  z
    .string()
    .max(300)
    .optional()
    .or(z.literal(""))
    .transform((v, ctx) => {
      const out = normalizeCommunityLink(platform, v);
      if (out && typeof out === "object") {
        ctx.addIssue({ code: "custom", message: out.error });
        return z.NEVER;
      }
      return out;
    });

const requiredCommunityLink = (platform: CommunityPlatform) =>
  z
    .string()
    .max(300)
    .transform((v, ctx) => {
      const out = normalizeCommunityLink(platform, v);
      if (out && typeof out === "object") {
        ctx.addIssue({ code: "custom", message: out.error });
        return z.NEVER;
      }
      if (!out) {
        ctx.addIssue({ code: "custom", message: "Add your X link." });
        return z.NEVER;
      }
      return out;
    });

const contactHandle = z
  .string()
  .trim()
  .min(1, "Enter a contact handle.")
  .max(64)
  .regex(/^@?[A-Za-z0-9_.#-]+$/, "Letters, numbers, _ . - only.")
  .transform((v) => cleanHandle(v)!);

/** The fixed intake fields, common to a self-filed and an admin-added request. */
const requestFieldsSchema = z.object({
  spotsRequested: z.coerce.number().int("Whole numbers only.").min(1, "Request at least 1 WL spot.").max(100_000),
  communityName: z.string().trim().min(2, "Enter your community's name.").max(80),
  communitySize: requiredCount("Enter your community size."),
  communityX: requiredCommunityLink("x"),
  communityDiscord: communityLink("discord"),
  communityTelegram: communityLink("telegram"),
  raffleProofImageUrl: optionalUrl,
  contactName: z.string().trim().min(2, "Enter a contact name.").max(80),
  contactMethod: contactMethodEnum,
  contactHandle,
});

export const requestFormSchema = requestFieldsSchema.extend({
  requesterTeamId: z.string().trim().min(1, "Pick which project is requesting."),
});

export type RequestFormInput = z.infer<typeof requestFormSchema>;

/** Same fixed fields, filed by a platform admin on behalf of a teamless project. */
export const adminRequestFormSchema = requestFieldsSchema;

export type AdminRequestFormInput = z.infer<typeof adminRequestFormSchema>;

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

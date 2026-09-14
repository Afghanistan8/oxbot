import { z } from "zod";

import { ALL_CHAINS } from "@/lib/constants";
import type { Blockchain } from "@prisma/client";

/**
 * Validation for giveaway creation + editing, including the per-requirement
 * config shapes. Requirements are validated with a discriminated union on
 * `type` so each kind only accepts its own config keys.
 */

const chainEnum = z.enum(ALL_CHAINS as [Blockchain, ...Blockchain[]]);
const typeEnum = z.enum(["RANDOM", "FCFS", "CODE"]);
const visibilityEnum = z.enum(["PUBLIC", "COMMUNITY", "PRIVATE"]);

// --- Requirement configs (per type) ---------------------------------------

const requirementSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("CAPTCHA"), required: z.boolean().default(true) }),
  z.object({ type: z.literal("EMAIL"), required: z.boolean().default(true) }),
  z.object({
    type: z.literal("CODE"),
    required: z.boolean().default(true),
    caseSensitive: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("TWITTER_FOLLOW"),
    required: z.boolean().default(true),
    handle: z
      .string()
      .trim()
      .min(1, "Enter the X handle to follow.")
      .max(30)
      .regex(/^@?[A-Za-z0-9_]+$/, "Enter a valid X handle."),
  }),
  z.object({
    type: z.literal("TWITTER_LIKE"),
    required: z.boolean().default(true),
    tweetUrl: z.string().trim().url("Enter the post URL.").max(300),
  }),
  z.object({
    type: z.literal("TWITTER_RETWEET"),
    required: z.boolean().default(true),
    tweetUrl: z.string().trim().url("Enter the post URL.").max(300),
  }),
  z.object({
    type: z.literal("DISCORD_MEMBER"),
    required: z.boolean().default(true),
    inviteUrl: z.string().trim().url("Enter the server's invite URL.").max(300),
    // Optional narrowing: with roles selected this becomes "be a member AND
    // hold one of these roles"; left empty it stays a plain membership check.
    roleIds: z.array(z.string().trim().min(1)).default([]),
  }),
  z.object({
    type: z.literal("DISCORD_ROLE"),
    required: z.boolean().default(true),
    roleIds: z
      .array(z.string().trim().min(1))
      .min(1, "Add at least one Discord role."),
    inviteUrl: z.string().trim().url("Enter the server's invite URL.").max(300),
  }),
  z.object({
    type: z.literal("WALLET"),
    // Always required — enforced here too, not just client-side, so a
    // request that bypasses the UI can't sneak an optional wallet task past
    // the winners export that depends on every entrant having one.
    required: z.literal(true).default(true),
    chain: chainEnum.optional(),
  }),
]);

export type RequirementInput = z.infer<typeof requirementSchema>;

// --- Giveaway -------------------------------------------------------------

const baseGiveaway = z.object({
  title: z.string().trim().min(3, "Title is too short.").max(120),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  prize: z.string().trim().min(2, "Describe the prize.").max(500),
  bannerUrl: z.string().trim().url("Enter a valid URL.").max(300).optional().or(z.literal("")),
  type: typeEnum,
  chain: chainEnum,
  visibility: visibilityEnum,
  winnersCount: z.coerce.number().int().min(1, "At least 1 winner.").max(10000),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  hideEntryCount: z.boolean().default(false),
  xAccount: z.string().trim().max(30).optional().or(z.literal("")),
  discordServerId: z.string().trim().max(40).optional().or(z.literal("")),
  telegram: z.string().trim().max(80).optional().or(z.literal("")),
  requirements: z.array(requirementSchema).max(12).default([]),
  // For CODE giveaways: optionally generate N codes at creation.
  generateCodes: z.coerce.number().int().min(0).max(5000).default(0),
  codePrefix: z.string().trim().max(12).regex(/^[A-Za-z0-9]*$/, "Letters/numbers only.").optional().or(z.literal("")),
  codeMaxUses: z.coerce.number().int().min(1).max(100000).default(1),
});

/**
 * Cross-field rules:
 *  - endAt must be after startAt.
 *  - FCFS winnersCount is the number of slots (>=1) — already covered.
 *  - CODE giveaways should have a CODE requirement OR request code generation;
 *    we auto-add a CODE requirement in the action if missing, so no hard error.
 *  - The project's Discord server is required for public/community giveaways.
 *    PRIVATE (code-gated) drops are exempt: they're shared directly with
 *    invitees and don't rely on a community to reach or verify entrants.
 */
export const giveawayFormSchema = baseGiveaway
  .refine((d) => d.endAt.getTime() > d.startAt.getTime(), {
    message: "End time must be after the start time.",
    path: ["endAt"],
  })
  .refine((d) => d.visibility === "PRIVATE" || Boolean(d.discordServerId), {
    message: "A Discord server ID is required unless the giveaway is private.",
    path: ["discordServerId"],
  })
  .refine(
    (d) =>
      d.requirements.every(
        (r) => r.type !== "DISCORD_MEMBER" && r.type !== "DISCORD_ROLE"
      ) || Boolean(d.discordServerId),
    {
      message: "Set a Discord server ID below to use a Discord entry requirement.",
      path: ["discordServerId"],
    }
  );

export type GiveawayFormInput = z.infer<typeof giveawayFormSchema>;

/** Draft schema — looser, for saving incomplete giveaways. */
export const giveawayDraftSchema = baseGiveaway.partial({
  startAt: true,
  endAt: true,
}).extend({
  title: z.string().trim().min(1, "Add a title to save a draft.").max(120),
});

export { requirementSchema, typeEnum, visibilityEnum, chainEnum };

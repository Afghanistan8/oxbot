import { z } from "zod";

import { ALL_CHAINS } from "@/lib/constants";

/**
 * Zod validation schemas shared by server actions and route handlers.
 * Keeping them centralized makes inputs consistent and testable.
 */

// Reusable primitives ------------------------------------------------------

/** A URL-safe slug: lowercase letters, numbers, single dashes. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Must be at least 3 characters.")
  .max(48, "Must be 48 characters or fewer.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single dashes."
  );

export const chainSchema = z.enum(
  ALL_CHAINS as [string, ...string[]]
);

const optionalUrl = z
  .string()
  .trim()
  .url("Enter a valid URL.")
  .max(300)
  .optional()
  .or(z.literal(""));

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

// Team ---------------------------------------------------------------------

export const createTeamSchema = z.object({
  name: z.string().trim().min(2, "Name is too short.").max(60),
  slug: slugSchema,
  description: optionalText(500),
});

export const updateTeamSchema = z.object({
  name: z.string().trim().min(2, "Name is too short.").max(60),
  description: optionalText(500),
  website: optionalUrl,
  xHandle: z
    .string()
    .trim()
    .max(30)
    .regex(/^[A-Za-z0-9_]*$/, "Handle can only contain letters, numbers, and _.")
    .optional()
    .or(z.literal("")),
  discordInvite: optionalUrl,
  discordGuildId: z
    .string()
    .trim()
    .max(32)
    .regex(/^[0-9]*$/, "A Discord server ID is numeric.")
    .optional()
    .or(z.literal("")),
  // Restricted to Discord's own domain — this URL is fetched server-side on
  // every publish, so accepting an arbitrary URL here would be an SSRF vector.
  discordWebhookUrl: z
    .string()
    .trim()
    .max(300)
    .regex(
      /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/.+$/,
      "Enter a valid Discord webhook URL."
    )
    .optional()
    .or(z.literal("")),
  telegram: optionalText(80),
  logoUrl: optionalUrl,
  bannerUrl: optionalUrl,
  chains: z.array(chainSchema).max(ALL_CHAINS.length).optional(),
  primaryChain: chainSchema.optional().or(z.literal("")),
  totalSupply: optionalText(40),
  mintPrice: optionalText(40),
  mintAt: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Enter a valid date & time."),
  mintTba: z.union([z.literal("true"), z.literal("false")]).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  role: z.enum(["ADMIN", "EDITOR"]),
});

export const changeRoleSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(["OWNER", "ADMIN", "EDITOR"]),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

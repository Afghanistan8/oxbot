import { z } from "zod";

/**
 * Validation for participant entry submissions.
 *
 * The entry form posts a small, fixed set of fields regardless of which
 * requirements a giveaway has; each requirement reads the field(s) it needs
 * (e.g. CODE reads `code`, EMAIL reads `email`). Social tasks (X / Discord) are
 * verified server-side against the participant's connected account, so they
 * carry no user-supplied value here.
 */
export const entrySubmissionSchema = z.object({
  /** CAPTCHA provider token (empty in mock mode — the mock auto-passes). */
  captchaToken: z.string().max(4000).optional().default(""),
  /** Email for the EMAIL requirement when the account has none on file. */
  email: z
    .string()
    .trim()
    .max(200)
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal("")),
  /** Access code for CODE giveaways / the CODE requirement. */
  code: z.string().trim().max(64).optional().or(z.literal("")),
  /** Wallet address for the (optional, Phase 1) WALLET requirement. */
  walletAddress: z.string().trim().max(120).optional().or(z.literal("")),
});

export type EntrySubmission = z.infer<typeof entrySubmissionSchema>;

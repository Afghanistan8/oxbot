import "server-only";

import { db } from "@/lib/db";
import { normalizeCode } from "@/lib/giveaway/codes";
import { verifyCaptcha } from "@/lib/integrations/captcha";
import {
  verifyFollows,
  verifyLiked,
  verifyReposted,
} from "@/lib/integrations/twitter";
import { verifyGuildMember, verifyGuildRoles } from "@/lib/integrations/discord";
import type { EntrySubmission } from "@/lib/validation/entry";
import type { GiveawayRequirement, RequirementType } from "@prisma/client";

/**
 * Entry-validation engine.
 *
 * Evaluates a single {@link GiveawayRequirement} against a participant and their
 * submission, returning a pass/fail + auditable detail. Social checks (X /
 * Discord) call the integration layer, which auto-mocks when no API keys are
 * configured — so entry flows work end-to-end in development.
 *
 * The CODE requirement is intentionally NOT evaluated here: redeeming a code
 * mutates state (atomic use-count increment) and must happen inside the entry
 * transaction, so the entry action handles it directly.
 */

export type RequirementConfig = {
  handle?: string;
  tweetUrl?: string;
  roleIds?: string[];
  inviteUrl?: string;
  caseSensitive?: boolean;
  chain?: string;
};

export type RequirementCheck = {
  /** Did the requirement pass? Optional requirements may fail without blocking. */
  ok: boolean;
  /** True when satisfied by a mock (no live integration configured). */
  mocked: boolean;
  /** Short human explanation, surfaced to the entrant on failure. */
  detail?: string;
};

/** Read a requirement's JSON config as a typed, best-effort object. */
export function readConfig(req: Pick<GiveawayRequirement, "config">): RequirementConfig {
  const c = (req.config ?? {}) as Record<string, unknown>;
  return {
    handle: typeof c.handle === "string" ? c.handle : undefined,
    tweetUrl: typeof c.tweetUrl === "string" ? c.tweetUrl : undefined,
    roleIds: Array.isArray(c.roleIds)
      ? c.roleIds.filter((r): r is string => typeof r === "string")
      : undefined,
    inviteUrl: typeof c.inviteUrl === "string" ? c.inviteUrl : undefined,
    caseSensitive: typeof c.caseSensitive === "boolean" ? c.caseSensitive : undefined,
    chain: typeof c.chain === "string" ? c.chain : undefined,
  };
}

/**
 * Extract a numeric tweet id from an X/Twitter status URL.
 * e.g. https://x.com/foo/status/1790000000000000000 → "1790000000000000000".
 * Falls back to the raw string if it already looks like an id.
 */
export function tweetIdFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/status(?:es)?\/(\d+)/);
  if (m?.[1]) return m[1];
  // Already just digits? Treat as an id.
  return /^\d+$/.test(url.trim()) ? url.trim() : null;
}

/** The X / Discord identity for a user, drawn from the NextAuth Account table. */
export type ConnectedAccounts = {
  twitterUserId: string | null;
  discordUserId: string | null;
  email: string | null;
};

/**
 * Load a participant's connected OAuth identities + email in one query.
 * OAuth accounts are populated by the Auth.js Prisma adapter on sign-in.
 */
export async function getConnectedAccounts(userId: string): Promise<ConnectedAccounts> {
  const [accounts, user] = await Promise.all([
    db.account.findMany({
      where: { userId, provider: { in: ["twitter", "discord"] } },
      select: { provider: true, providerAccountId: true },
    }),
    db.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);

  const twitter = accounts.find((a) => a.provider === "twitter");
  const discord = accounts.find((a) => a.provider === "discord");
  return {
    twitterUserId: twitter?.providerAccountId ?? null,
    discordUserId: discord?.providerAccountId ?? null,
    email: user?.email ?? null,
  };
}

/**
 * Evaluate one requirement. `code` is handled by the caller (transactional),
 * so passing a CODE requirement here returns a neutral pass — the action gates
 * the real redemption. `discordServerId` comes from the giveaway itself (set
 * once in Project links), not from the requirement's own config — every
 * Discord requirement on a giveaway gates the same server.
 */
export async function checkRequirement(
  type: RequirementType,
  config: RequirementConfig,
  submission: EntrySubmission,
  accounts: ConnectedAccounts,
  discordServerId: string | null
): Promise<RequirementCheck> {
  switch (type) {
    case "CAPTCHA": {
      const r = await verifyCaptcha(submission.captchaToken || null);
      return { ok: r.ok, mocked: r.mocked, detail: r.detail };
    }

    case "EMAIL": {
      // Satisfied by a verified account email or a valid email in the form.
      const email = (accounts.email || submission.email || "").trim();
      const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
      return {
        ok,
        mocked: false,
        detail: ok ? "Email on file" : "A valid email is required.",
      };
    }

    case "CODE":
      // Redeemed transactionally by the entry action; neutral here.
      return { ok: true, mocked: false, detail: "Validated at submission." };

    case "TWITTER_FOLLOW": {
      if (!config.handle) return { ok: false, mocked: false, detail: "Misconfigured task." };
      const r = await verifyFollows(accounts.twitterUserId, config.handle);
      return { ok: r.ok, mocked: r.mocked, detail: r.detail };
    }

    case "TWITTER_LIKE": {
      const tweetId = tweetIdFromUrl(config.tweetUrl);
      if (!tweetId) return { ok: false, mocked: false, detail: "Misconfigured task." };
      const r = await verifyLiked(accounts.twitterUserId, tweetId);
      return { ok: r.ok, mocked: r.mocked, detail: r.detail };
    }

    case "TWITTER_RETWEET": {
      const tweetId = tweetIdFromUrl(config.tweetUrl);
      if (!tweetId) return { ok: false, mocked: false, detail: "Misconfigured task." };
      const r = await verifyReposted(accounts.twitterUserId, tweetId);
      return { ok: r.ok, mocked: r.mocked, detail: r.detail };
    }

    // Both Discord tasks share one path: when the founder selected roles, the
    // entrant must hold at least one of them; with none selected it's a plain
    // membership check. DISCORD_ROLE always has roles (schema enforces >= 1);
    // DISCORD_MEMBER may optionally narrow to specific roles.
    case "DISCORD_MEMBER":
    case "DISCORD_ROLE": {
      if (!discordServerId) {
        return { ok: false, mocked: false, detail: "Misconfigured task — no Discord server linked." };
      }
      const roleIds = config.roleIds ?? [];
      const r = roleIds.length
        ? await verifyGuildRoles(accounts.discordUserId, discordServerId, roleIds)
        : await verifyGuildMember(accounts.discordUserId, discordServerId);
      return { ok: r.ok, mocked: r.mocked, detail: r.detail };
    }

    case "WALLET": {
      // Phase 1: accept any non-empty address; real signature verification is Phase 2.
      const addr = (submission.walletAddress || "").trim();
      const ok = addr.length >= 8;
      return {
        ok,
        mocked: true,
        detail: ok ? "Wallet provided (unverified in Phase 1)." : "Enter a wallet address.",
      };
    }

    default:
      return { ok: false, mocked: false, detail: "Unknown requirement." };
  }
}

/** Compare a submitted code against a stored one, honoring case sensitivity. */
export function codeMatches(
  submitted: string,
  stored: string,
  caseSensitive: boolean
): boolean {
  return normalizeCode(submitted, caseSensitive) === normalizeCode(stored, caseSensitive);
}

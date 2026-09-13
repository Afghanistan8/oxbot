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
import { checkHolding } from "@/lib/integrations/nft";
import { EVM_CHAINS } from "@/lib/constants";
import type { EntrySubmission } from "@/lib/validation/entry";
import type { Blockchain, GiveawayRequirement, RequirementType } from "@prisma/client";

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
  // NFT_HOLD / TOKEN_BALANCE
  contractAddress?: string;
  minCount?: number;
  tokenIds?: string[];
  minBalance?: string;
  label?: string;
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
    contractAddress: typeof c.contractAddress === "string" ? c.contractAddress : undefined,
    minCount: typeof c.minCount === "number" ? c.minCount : undefined,
    tokenIds: Array.isArray(c.tokenIds)
      ? c.tokenIds.filter((t): t is string => typeof t === "string")
      : undefined,
    minBalance: typeof c.minBalance === "string" ? c.minBalance : undefined,
    label: typeof c.label === "string" ? c.label : undefined,
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
  /** Saved profile wallets (one per chain) — used by holding checks. */
  wallets: { chain: Blockchain; address: string }[];
};

/**
 * Load a participant's connected OAuth identities, email and saved wallets.
 * OAuth accounts are populated by the Auth.js Prisma adapter on sign-in.
 */
export async function getConnectedAccounts(userId: string): Promise<ConnectedAccounts> {
  const [accounts, user, wallets] = await Promise.all([
    db.account.findMany({
      where: { userId, provider: { in: ["twitter", "discord"] } },
      select: { provider: true, providerAccountId: true },
    }),
    db.user.findUnique({ where: { id: userId }, select: { email: true } }),
    db.wallet.findMany({
      where: { userId, address: { not: "" } },
      select: { chain: true, address: true },
    }),
  ]);

  const twitter = accounts.find((a) => a.provider === "twitter");
  const discord = accounts.find((a) => a.provider === "discord");
  return {
    twitterUserId: twitter?.providerAccountId ?? null,
    discordUserId: discord?.providerAccountId ?? null,
    email: user?.email ?? null,
    wallets,
  };
}

/**
 * The wallet a holding task checks: the entrant's saved wallet on the task's
 * chain; for EVM chains any saved 0x wallet (same address everywhere); else a
 * wallet pasted into the entry form.
 */
export function walletForHolding(
  chain: Blockchain,
  accounts: ConnectedAccounts,
  pasted: string | undefined
): string | null {
  const exact = accounts.wallets.find((w) => w.chain === chain)?.address.trim();
  if (exact) return exact;
  if (EVM_CHAINS.includes(chain)) {
    const evm = accounts.wallets.find((w) => /^0x[0-9a-fA-F]{40}$/.test(w.address.trim()));
    if (evm) return evm.address.trim();
  }
  const p = (pasted ?? "").trim();
  return p.length >= 8 ? p : null;
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
  discordServerId: string | null,
  /** The requirement row id — holding tasks match it against attestations. */
  requirementId?: string
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

    case "NFT_HOLD":
    case "TOKEN_BALANCE": {
      const chain = config.chain as Blockchain | undefined;
      if (!chain || !config.contractAddress) {
        return { ok: false, mocked: false, detail: "Misconfigured task." };
      }
      const owner = walletForHolding(chain, accounts, submission.walletAddress);
      if (!owner) {
        return {
          ok: false,
          mocked: false,
          detail: "Save a wallet on your profile (or paste one below) so we can check your holdings.",
        };
      }
      const r = await checkHolding({
        kind: type,
        chain,
        contractAddress: config.contractAddress,
        owner,
        minCount: config.minCount,
        tokenIds: config.tokenIds,
        minBalance: config.minBalance,
        label: config.label,
      });
      if (r.ok !== null) return { ok: r.ok, mocked: r.mocked, detail: r.detail };

      // Not verified on-chain (mock mode / unconfigured chain): a wallet on file
      // plus the entrant's explicit attestation completes the task.
      const attested = Boolean(requirementId && submission.holdingAttestations.includes(requirementId));
      return attested
        ? { ok: true, mocked: true, detail: `Mock: holding attested for ${owner.slice(0, 6)}…${owner.slice(-4)}.` }
        : { ok: false, mocked: true, detail: "Tick “I hold this” to confirm, then submit." };
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

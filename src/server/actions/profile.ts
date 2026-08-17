"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { PROFILE_WALLET_CHAINS } from "@/lib/constants";
import { ActionState, ok, fail, runAction, zodFieldErrors } from "./_result";
import type { Blockchain } from "@prisma/client";

/**
 * Profile server actions (participant side).
 *
 * Wallets are a plain profile field, not a login credential — pasting an
 * address for a chain replaces whatever was there before, no confirmation
 * step. One fixed slot per supported chain.
 */

const addressField = z
  .string()
  .trim()
  .max(120)
  .optional()
  .or(z.literal(""));

const walletsSchema = z.object({
  SOLANA: addressField,
  ETHEREUM: addressField,
  ROBINHOOD: addressField,
  BASE: addressField,
  ARBITRUM: addressField,
});

export async function saveWalletsAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();

  return runAction(async () => {
    const rl = rateLimit(`wallet:${userId}`, RATE_LIMITS.mutate.limit, RATE_LIMITS.mutate.windowMs);
    if (!rl.success) return fail("Too many attempts. Please slow down.");

    const parsed = walletsSchema.safeParse({
      SOLANA: formData.get("wallet_SOLANA") ?? "",
      ETHEREUM: formData.get("wallet_ETHEREUM") ?? "",
      ROBINHOOD: formData.get("wallet_ROBINHOOD") ?? "",
      BASE: formData.get("wallet_BASE") ?? "",
      ARBITRUM: formData.get("wallet_ARBITRUM") ?? "",
    });
    if (!parsed.success) {
      return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
    }

    await db.$transaction(
      PROFILE_WALLET_CHAINS.map((chain) => {
        const address = (parsed.data[chain] ?? "").trim();
        if (address) {
          return db.wallet.upsert({
            where: { userId_chain: { userId, chain: chain as Blockchain } },
            create: { userId, chain: chain as Blockchain, address },
            update: { address },
          });
        }
        // Blank field => clear any previously saved address for this chain.
        return db.wallet.deleteMany({ where: { userId, chain: chain as Blockchain } });
      })
    );

    revalidatePath("/profile");
    return ok(undefined, "Wallets saved.");
  });
}

// --- Social connections ------------------------------------------------------

/**
 * Disconnects a linked X/Discord identity used for entry-task verification.
 * This only removes the SocialConnection record (profile-side data) — it
 * never touches the NextAuth Account used for signing in, so unlinking X
 * can't lock anyone out of their account.
 */
export async function disconnectSocialAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const provider = String(formData.get("provider") ?? "");
  if (provider !== "twitter" && provider !== "discord") return;

  const rl = rateLimit(`social-disconnect:${userId}`, RATE_LIMITS.mutate.limit, RATE_LIMITS.mutate.windowMs);
  if (!rl.success) return;

  await db.socialConnection.deleteMany({ where: { userId, provider } });

  revalidatePath("/profile");
}

// --- Profile picture --------------------------------------------------------

/**
 * Avatars are stored as a compact base64 data URL directly on `User.image`
 * rather than as an uploaded file. The app's file-upload path
 * (lib/integrations/uploads.ts) writes to local disk, which does not persist
 * on serverless hosts like Vercel — a small, client-resized avatar stored
 * inline sidesteps that entirely with zero extra infra. Capped well below the
 * Postgres text-column practical limit.
 */
const MAX_DATA_URL_LENGTH = 400_000; // ~300KB of image data once base64-decoded

const imageSchema = z.object({
  image: z
    .string()
    .trim()
    .max(MAX_DATA_URL_LENGTH, "Image is too large.")
    .regex(/^data:image\/(png|jpeg|webp);base64,/, "Unsupported image format.")
    .optional()
    .or(z.literal("")),
});

export async function updateProfileImageAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();

  return runAction(async () => {
    const rl = rateLimit(`avatar:${userId}`, RATE_LIMITS.mutate.limit, RATE_LIMITS.mutate.windowMs);
    if (!rl.success) return fail("Too many attempts. Please slow down.");

    const parsed = imageSchema.safeParse({ image: formData.get("image") ?? "" });
    if (!parsed.success) {
      return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
    }

    await db.user.update({
      where: { id: userId },
      data: { image: parsed.data.image || null },
    });

    revalidatePath("/profile");
    return ok(undefined, parsed.data.image ? "Profile picture updated." : "Profile picture removed.");
  });
}

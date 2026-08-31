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

// One optional address field per profile wallet chain, built straight from
// PROFILE_WALLET_CHAINS so adding a chain there is the ONLY change ever needed
// — no per-chain lines here to drift out of sync.
const walletsSchema = z.object(
  Object.fromEntries(PROFILE_WALLET_CHAINS.map((c) => [c, addressField])) as Record<
    (typeof PROFILE_WALLET_CHAINS)[number],
    typeof addressField
  >
);

export async function saveWalletsAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();

  return runAction(async () => {
    const rl = rateLimit(`wallet:${userId}`, RATE_LIMITS.mutate.limit, RATE_LIMITS.mutate.windowMs);
    if (!rl.success) return fail("Too many attempts. Please slow down.");

    const parsed = walletsSchema.safeParse(
      Object.fromEntries(
        PROFILE_WALLET_CHAINS.map((c) => [c, formData.get(`wallet_${c}`) ?? ""])
      )
    );
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

// --- Win notifications ---------------------------------------------------

/**
 * Stamps the given winner rows as notified, so the "you won!" toast never
 * shows twice. Scoped to the caller's own userId — a winnerId belonging to
 * someone else is silently ignored, never marked.
 */
export async function markWinsNotifiedAction(winnerIds: string[]): Promise<void> {
  const userId = await requireUserId();
  if (winnerIds.length === 0) return;
  await db.winner.updateMany({
    where: { id: { in: winnerIds }, userId },
    data: { notifiedAt: new Date() },
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

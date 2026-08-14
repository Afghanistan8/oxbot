"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { verifyCaptcha } from "@/lib/integrations/captcha";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { chainEnum } from "@/lib/validation/giveaway";
import { ActionState, ok, fail, runAction, zodFieldErrors } from "./_result";
import type { Blockchain } from "@prisma/client";

/**
 * Profile server actions (participant side).
 *
 * The primary wallet is the account's single main wallet, used to verify
 * WALLET entry requirements. Setting it the first time is unguarded; REPLACING
 * an already-set primary wallet requires a CAPTCHA pass, so a stolen session
 * alone can't silently swap out the wallet an account is known by.
 */
const walletSchema = z.object({
  chain: chainEnum,
  address: z.string().trim().min(4, "Enter a wallet address.").max(120),
  captchaToken: z.string().max(4000).optional().default(""),
});

export async function setPrimaryWalletAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();

  return runAction(async () => {
    const rl = rateLimit(`wallet:${userId}`, RATE_LIMITS.mutate.limit, RATE_LIMITS.mutate.windowMs);
    if (!rl.success) return fail("Too many attempts. Please slow down.");

    const parsed = walletSchema.safeParse({
      chain: formData.get("chain"),
      address: formData.get("address"),
      captchaToken: formData.get("captchaToken") ?? "",
    });
    if (!parsed.success) {
      return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
    }
    const { chain, address, captchaToken } = parsed.data;

    const current = await db.wallet.findFirst({
      where: { userId, isPrimary: true },
      select: { chain: true, address: true },
    });
    const isChange = current && (current.chain !== chain || current.address !== address);

    if (isChange) {
      const captcha = await verifyCaptcha(captchaToken || null);
      if (!captcha.ok) {
        return fail("Please complete the CAPTCHA to change your wallet.");
      }
    }

    await db.$transaction(async (tx) => {
      await tx.wallet.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });
      await tx.wallet.upsert({
        where: { userId_chain_address: { userId, chain: chain as Blockchain, address } },
        create: { userId, chain: chain as Blockchain, address, isPrimary: true },
        update: { isPrimary: true },
      });
    });

    revalidatePath("/profile");
    return ok(undefined, current ? "Wallet updated." : "Wallet connected.");
  });
}

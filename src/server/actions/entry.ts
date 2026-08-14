"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { giveawayPhase } from "@/lib/format";
import { entrySubmissionSchema } from "@/lib/validation/entry";
import {
  checkRequirement,
  getConnectedAccounts,
  readConfig,
} from "@/lib/giveaway/entry-validation";
import { ActionState, ok, fail, runAction, zodFieldErrors } from "./_result";
import type { Prisma, RequirementStatus } from "@prisma/client";

/**
 * Entry submission action.
 *
 * Correctness-critical concurrency:
 *  - FCFS/ordering: a per-giveaway `fcfsCursor` is incremented atomically inside
 *    the transaction to assign each completed entry a unique, monotonic `seq`.
 *  - Codes: redeemed with a compare-and-swap (`updateMany` guarded by
 *    `uses < maxUses`) so a code can never be redeemed beyond its cap, even
 *    under concurrent submissions.
 *  - One entry per user is guaranteed by the `@@unique([giveawayId, userId])`
 *    constraint; we upsert and never double-assign a slot.
 *
 * Social / CAPTCHA / email checks run BEFORE the transaction (they do network
 * I/O) so we never hold a DB transaction open across an external call.
 */

export type EntryResult = {
  completed: boolean;
  seq: number | null;
  /** Per-requirement pass/fail for the wizard to render. */
  statuses: { requirementId: string; ok: boolean; detail?: string }[];
};

/** Thrown inside the tx when a code is exhausted/revoked between check + redeem. */
class CodeRaceError extends Error {}

export async function submitEntryAction(
  giveawayId: string,
  slug: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionState<EntryResult>> {
  const userId = await requireUserId(`/giveaways/${slug}`);

  const result = await runAction<EntryResult>(async () => {
    // Rate-limit entry submissions per user.
    const rl = rateLimit(`entry:${userId}`, RATE_LIMITS.entry.limit, RATE_LIMITS.entry.windowMs);
    if (!rl.success) {
      return fail(`Too many attempts. Try again in ${rl.retryAfter}s.`);
    }

    const giveaway = await db.giveaway.findUnique({
      where: { id: giveawayId },
      include: {
        requirements: { orderBy: { order: "asc" } },
        team: { select: { slug: true } },
      },
    });
    if (!giveaway) return fail("Giveaway not found.");

    // Entry window / status gate.
    const phase = giveawayPhase(giveaway);
    if (phase === "draft" || phase === "cancelled") {
      return fail("This giveaway isn't open for entries.");
    }
    if (phase === "upcoming") return fail("This giveaway hasn't started yet.");
    if (phase === "ended" || phase === "finalized") {
      return fail("This giveaway has closed. Entries are no longer accepted.");
    }

    // Existing entry (for idempotent re-submission + code-double-redeem guard).
    const existing = await db.entry.findUnique({
      where: { giveawayId_userId: { giveawayId, userId } },
      include: { codeUse: { select: { id: true } } },
    });
    if (existing?.status === "COMPLETED") {
      return ok(
        { completed: true, seq: existing.seq, statuses: [] },
        "You've already entered this giveaway."
      );
    }
    const alreadyRedeemedCode = Boolean(existing?.codeUse);

    // Parse the submission payload.
    const parsed = entrySubmissionSchema.safeParse({
      captchaToken: formData.get("captchaToken") ?? "",
      email: formData.get("email") ?? "",
      code: formData.get("code") ?? "",
      walletAddress: formData.get("walletAddress") ?? "",
    });
    if (!parsed.success) {
      return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
    }
    const submission = parsed.data;

    // --- Evaluate non-CODE requirements (network I/O, outside the tx) --------
    const accounts = await getConnectedAccounts(userId);
    const pass = new Map<string, { ok: boolean; detail?: string }>();
    const mockedTypes: string[] = [];

    for (const req of giveaway.requirements) {
      if (req.type === "CODE") continue; // handled transactionally below
      const check = await checkRequirement(
        req.type,
        readConfig(req),
        submission,
        accounts,
        giveaway.discordServerId
      );
      pass.set(req.id, { ok: check.ok, detail: check.detail });
      if (check.mocked) mockedTypes.push(req.type);
    }

    // --- CODE requirement: read-only pre-validation --------------------------
    const codeReq = giveaway.requirements.find((r) => r.type === "CODE");
    let matchedCode: { id: string; maxUses: number } | null = null;

    if (codeReq) {
      if (alreadyRedeemedCode) {
        pass.set(codeReq.id, { ok: true, detail: "Code already redeemed." });
      } else {
        const submitted = (submission.code ?? "").trim();
        if (!submitted) {
          pass.set(codeReq.id, { ok: false, detail: "Enter your access code." });
        } else {
          const caseSensitive = readConfig(codeReq).caseSensitive ?? false;
          const found = await db.entryCode.findFirst({
            where: {
              giveawayId,
              revoked: false,
              ...(caseSensitive
                ? { code: submitted }
                : { code: { equals: submitted, mode: "insensitive" } }),
            },
            select: { id: true, uses: true, maxUses: true },
          });
          if (!found || found.uses >= found.maxUses) {
            pass.set(codeReq.id, { ok: false, detail: "Invalid or used code." });
          } else {
            matchedCode = { id: found.id, maxUses: found.maxUses };
            pass.set(codeReq.id, { ok: true, detail: "Code accepted." });
          }
        }
      }
    }

    // All REQUIRED requirements must pass to complete the entry.
    const requiredPass = giveaway.requirements
      .filter((r) => r.required)
      .every((r) => pass.get(r.id)?.ok);

    const now = new Date();
    const metadata: Prisma.InputJsonValue = {
      mocked: Array.from(new Set(mockedTypes)),
      ...(submission.walletAddress ? { wallet: submission.walletAddress } : {}),
      lastAttemptAt: now.toISOString(),
    };

    // --- Transaction: upsert entry, redeem code, write statuses, finalize ----
    const completed = requiredPass;
    let seq: number | null = existing?.seq ?? null;

    try {
      await db.$transaction(async (tx) => {
        const entry = await tx.entry.upsert({
          where: { giveawayId_userId: { giveawayId, userId } },
          create: { giveawayId, userId, status: "PENDING", metadata },
          update: {},
          select: { id: true, seq: true },
        });

        // Redeem a code exactly once, only when the entry will complete.
        if (requiredPass && codeReq && matchedCode && !alreadyRedeemedCode) {
          const redeemed = await tx.entryCode.updateMany({
            where: { id: matchedCode.id, revoked: false, uses: { lt: matchedCode.maxUses } },
            data: { uses: { increment: 1 } },
          });
          if (redeemed.count === 0) throw new CodeRaceError();
          await tx.entryCodeRedemption.create({
            data: { codeId: matchedCode.id, entryId: entry.id },
          });
        }

        // Persist per-requirement statuses (audit trail + wizard display).
        for (const req of giveaway.requirements) {
          const p = pass.get(req.id);
          const status: RequirementStatus = p?.ok ? "COMPLETED" : "FAILED";
          await tx.entryRequirementStatus.upsert({
            where: { entryId_requirementId: { entryId: entry.id, requirementId: req.id } },
            create: {
              entryId: entry.id,
              requirementId: req.id,
              status,
              detail: p?.detail ? { message: p.detail } : undefined,
              checkedAt: now,
            },
            update: {
              status,
              detail: p?.detail ? { message: p.detail } : undefined,
              checkedAt: now,
            },
          });
        }

        // Finalize the entry. Assign an ordinal seq once, atomically.
        if (requiredPass) {
          let assigned = entry.seq;
          if (assigned == null) {
            const bumped = await tx.giveaway.update({
              where: { id: giveawayId },
              data: { fcfsCursor: { increment: 1 } },
              select: { fcfsCursor: true },
            });
            assigned = bumped.fcfsCursor;
          }
          await tx.entry.update({
            where: { id: entry.id },
            data: { status: "COMPLETED", seq: assigned, submittedAt: now, metadata },
          });
          seq = assigned;
        } else {
          await tx.entry.update({
            where: { id: entry.id },
            data: { status: "PENDING", metadata },
          });
        }
      });
    } catch (err) {
      if (err instanceof CodeRaceError) {
        return fail("That code just became unavailable. Please try another.");
      }
      throw err;
    }

    const statuses = giveaway.requirements.map((r) => {
      const p = pass.get(r.id);
      return { requirementId: r.id, ok: Boolean(p?.ok), detail: p?.detail };
    });

    revalidatePath(`/giveaways/${slug}`);
    revalidatePath(`/dashboard/${giveaway.team.slug}/giveaways/${giveawayId}`);

    return completed
      ? ok({ completed: true, seq, statuses }, "You're in! Your entry is confirmed.")
      : ok(
          { completed: false, seq: null, statuses },
          "Some required tasks aren't complete yet. Fix them and submit again."
        );
  });

  return result;
}

"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { requireTeamRole, AuthzError } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { giveawayPhase } from "@/lib/format";
import { readConfig } from "@/lib/giveaway/entry-validation";
import { verifyGuildMember, verifyGuildRoles } from "@/lib/integrations/discord";
import {
  generateDrawSeed,
  selectWinners,
  winnerMethodFor,
} from "@/lib/giveaway/winner-selection";
import { ActionState, ok, fail, runAction } from "./_result";
import type { GiveawayRequirement, GiveawayType } from "@prisma/client";

/**
 * Winner-drawing actions (founder side, EDITOR+).
 *
 * Draw / re-roll are provably fair: a fresh CSPRNG seed is generated, stored on
 * the giveaway, and used by the pure {@link selectWinners} routine so the result
 * is reproducible from the seed. Required Discord requirements are RE-CHECKED at
 * draw time (mock passes in dev) — entrants who no longer qualify are
 * disqualified and excluded before selection. All writes are transactional and
 * audited.
 */

function checkMutateLimit(userId: string) {
  const rl = rateLimit(`mutate:${userId}`, RATE_LIMITS.mutate.limit, RATE_LIMITS.mutate.windowMs);
  if (!rl.success) {
    throw new AuthzError("You're doing that too fast. Please slow down.", "FORBIDDEN");
  }
}

type Candidate = { id: string; userId: string; seq: number | null };

type DrawableGiveaway = {
  id: string;
  teamId: string;
  slug: string;
  type: GiveawayType;
  winnersCount: number;
  discordServerId: string | null;
  team: { slug: string };
  requirements: GiveawayRequirement[];
};

/**
 * Re-verify required Discord requirements for each candidate at draw time.
 * Returns the still-eligible entries and those to disqualify. When the giveaway
 * has no required Discord tasks, every candidate passes untouched.
 *
 * Note: in live mode this makes one API call per candidate per Discord task —
 * acceptable for Phase 1 draw sizes; a batched check is a Phase 2 concern. In
 * mock mode (no bot token) everything passes with no network calls.
 */
async function recheckDiscordEligibility(
  giveaway: DrawableGiveaway,
  candidates: Candidate[]
): Promise<{ eligible: Candidate[]; disqualified: Candidate[] }> {
  const discordReqs = giveaway.requirements.filter(
    (r) => r.required && (r.type === "DISCORD_MEMBER" || r.type === "DISCORD_ROLE")
  );
  if (discordReqs.length === 0 || !giveaway.discordServerId) {
    return { eligible: candidates, disqualified: [] };
  }
  const guildId = giveaway.discordServerId;

  // Load every candidate's Discord identity in one query.
  const accounts = await db.account.findMany({
    where: { provider: "discord", userId: { in: candidates.map((c) => c.userId) } },
    select: { userId: true, providerAccountId: true },
  });
  const discordByUser = new Map(accounts.map((a) => [a.userId, a.providerAccountId]));

  const eligible: Candidate[] = [];
  const disqualified: Candidate[] = [];

  for (const c of candidates) {
    const discordUserId = discordByUser.get(c.userId) ?? null;
    let passes = true;
    for (const req of discordReqs) {
      const cfg = readConfig(req);
      // Mirrors checkRequirement: roles when the founder selected any (either
      // Discord task type may carry them), plain membership otherwise.
      const roleIds = cfg.roleIds ?? [];
      const res = roleIds.length
        ? await verifyGuildRoles(discordUserId, guildId, roleIds)
        : await verifyGuildMember(discordUserId, guildId);
      if (!res.ok) {
        passes = false;
        break;
      }
    }
    (passes ? eligible : disqualified).push(c);
  }

  return { eligible, disqualified };
}

/** Shared draw routine for both first draw and re-roll. */
async function performDraw(
  giveaway: DrawableGiveaway,
  actorId: string,
  mode: "draw" | "reroll"
): Promise<ActionState<{ count: number }>> {
  const candidates = await db.entry.findMany({
    where: { giveawayId: giveaway.id, status: "COMPLETED" },
    select: { id: true, userId: true, seq: true },
  });
  if (candidates.length === 0) {
    return fail("No completed entries are eligible to win yet.");
  }

  const { eligible, disqualified } = await recheckDiscordEligibility(giveaway, candidates);
  if (eligible.length === 0) {
    return fail("No entries remained eligible after re-checking requirements.");
  }

  const seed = generateDrawSeed();
  const method = winnerMethodFor(giveaway.type);
  const selected = selectWinners(
    eligible.map((e) => ({ entryId: e.id, userId: e.userId, seq: e.seq })),
    giveaway.winnersCount,
    { type: giveaway.type, seed }
  );

  const now = new Date();
  await db.$transaction(async (tx) => {
    // Entrants who failed the re-check are removed from the pool.
    if (disqualified.length) {
      await tx.entry.updateMany({
        where: { id: { in: disqualified.map((d) => d.id) } },
        data: { status: "DISQUALIFIED" },
      });
    }
    // Replace any prior winners (re-roll) and write the new set.
    await tx.winner.deleteMany({ where: { giveawayId: giveaway.id } });
    await tx.winner.createMany({
      data: selected.map((s) => ({
        giveawayId: giveaway.id,
        entryId: s.entryId,
        userId: s.userId,
        rank: s.rank,
        method,
      })),
    });
    await tx.giveaway.update({
      where: { id: giveaway.id },
      data: { status: "FINALIZED", drawSeed: seed, drawnAt: now },
    });
  });

  await recordAudit({
    teamId: giveaway.teamId,
    actorId,
    action: mode === "reroll" ? "winners.reroll" : "winners.draw",
    target: giveaway.id,
    meta: {
      method,
      winners: selected.length,
      seed,
      disqualified: disqualified.length,
      eligible: eligible.length,
    },
  });

  revalidatePath(`/dashboard/${giveaway.team.slug}/giveaways/${giveaway.id}`);
  revalidatePath(`/giveaways/${giveaway.slug}`);
  revalidatePath("/");

  const count = selected.length;
  return ok(
    { count },
    mode === "reroll"
      ? `Re-rolled — ${count} winner${count === 1 ? "" : "s"} selected.`
      : `Drew ${count} winner${count === 1 ? "" : "s"}.`
  );
}

/** Draw winners for the first time. Requires the giveaway to have ended. */
export async function drawWinnersAction(
  giveawayId: string
): Promise<ActionState<{ count: number }>> {
  const userId = await requireUserId();

  return runAction<{ count: number }>(async () => {
    checkMutateLimit(userId);

    const giveaway = await db.giveaway.findUnique({
      where: { id: giveawayId },
      include: { team: { select: { slug: true } }, requirements: true },
    });
    if (!giveaway) return fail("Giveaway not found.");
    await requireTeamRole(userId, giveaway.teamId, "EDITOR");

    const phase = giveawayPhase(giveaway);
    if (phase === "draft" || phase === "cancelled") {
      return fail("This giveaway can't be drawn.");
    }
    if (phase === "upcoming" || phase === "live") {
      return fail("End the giveaway first — you can draw winners once entry closes.");
    }
    if (giveaway.status === "FINALIZED") {
      return fail("Winners have already been drawn. Use re-roll to draw again.");
    }

    return performDraw(giveaway, userId, "draw");
  });
}

/** Re-roll winners for an already-finalized giveaway with a fresh seed. */
export async function rerollWinnersAction(
  giveawayId: string
): Promise<ActionState<{ count: number }>> {
  const userId = await requireUserId();

  return runAction<{ count: number }>(async () => {
    checkMutateLimit(userId);

    const giveaway = await db.giveaway.findUnique({
      where: { id: giveawayId },
      include: { team: { select: { slug: true } }, requirements: true },
    });
    if (!giveaway) return fail("Giveaway not found.");
    await requireTeamRole(userId, giveaway.teamId, "EDITOR");

    if (giveaway.status !== "FINALIZED") {
      return fail("Only a giveaway with drawn winners can be re-rolled.");
    }

    return performDraw(giveaway, userId, "reroll");
  });
}

/**
 * Disqualify or reinstate a single entry (founder moderation). Disqualifying
 * removes any winner slot it held (re-roll to backfill). Reinstating returns the
 * entry to COMPLETED when it had been submitted, else PENDING.
 */
export async function setEntryDisqualifiedAction(
  entryId: string,
  disqualified: boolean
): Promise<ActionState> {
  const userId = await requireUserId();

  return runAction(async () => {
    checkMutateLimit(userId);

    const entry = await db.entry.findUnique({
      where: { id: entryId },
      include: {
        giveaway: { select: { id: true, slug: true, teamId: true, team: { select: { slug: true } } } },
        winner: { select: { id: true } },
      },
    });
    if (!entry) return fail("Entry not found.");
    await requireTeamRole(userId, entry.giveaway.teamId, "EDITOR");

    if (disqualified) {
      await db.$transaction(async (tx) => {
        if (entry.winner) {
          await tx.winner.delete({ where: { id: entry.winner.id } });
        }
        await tx.entry.update({
          where: { id: entryId },
          data: { status: "DISQUALIFIED" },
        });
      });
    } else {
      await db.entry.update({
        where: { id: entryId },
        data: { status: entry.submittedAt ? "COMPLETED" : "PENDING" },
      });
    }

    await recordAudit({
      teamId: entry.giveaway.teamId,
      actorId: userId,
      action: "entry.disqualify",
      target: entryId,
      meta: { disqualified },
    });

    revalidatePath(`/dashboard/${entry.giveaway.team.slug}/giveaways/${entry.giveaway.id}`);
    revalidatePath(`/giveaways/${entry.giveaway.slug}`);
    return ok(undefined, disqualified ? "Entry disqualified." : "Entry reinstated.");
  });
}

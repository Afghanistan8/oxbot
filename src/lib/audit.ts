import "server-only";

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * Audit logging for team-scoped actions.
 *
 * Every mutating founder action (team changes, giveaway lifecycle, code
 * generation, winner draws) should record an entry so teams have a tamper-
 * evident history. Writes are best-effort: a logging failure must never break
 * the underlying action, so callers can fire-and-forget.
 */

export type AuditAction =
  | "team.create"
  | "team.update"
  | "team.delete"
  | "member.invite"
  | "member.invite.revoke"
  | "member.join"
  | "member.role_change"
  | "member.remove"
  | "giveaway.create"
  | "giveaway.update"
  | "giveaway.duplicate"
  | "giveaway.publish"
  | "giveaway.end"
  | "giveaway.cancel"
  | "codes.generate"
  | "codes.revoke"
  | "winners.draw"
  | "winners.reroll"
  | "winners.finalize"
  | "entry.disqualify";

export type AuditInput = {
  teamId: string;
  actorId?: string | null;
  action: AuditAction;
  target?: string | null;
  meta?: Prisma.InputJsonValue;
};

/**
 * Record an audit entry. Best-effort — never throws into the caller.
 * Accepts an optional transaction client so it can participate in a tx.
 */
export async function recordAudit(
  input: AuditInput,
  client: Pick<typeof db, "auditLog"> = db
): Promise<void> {
  try {
    await client.auditLog.create({
      data: {
        teamId: input.teamId,
        actorId: input.actorId ?? null,
        action: input.action,
        target: input.target ?? null,
        meta: input.meta ?? undefined,
      },
    });
  } catch (err) {
    // Swallow — auditing must not break the primary operation.
    console.error("[audit] failed to record", input.action, err);
  }
}

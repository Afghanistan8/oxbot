"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { requireTeamRole, AuthzError } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { randomToken } from "@/lib/giveaway/codes";
import { roleAtLeast } from "@/lib/constants";
import {
  createTeamSchema,
  updateTeamSchema,
  inviteMemberSchema,
  changeRoleSchema,
} from "@/lib/validation/team";
import { ActionState, ok, fail, runAction, zodFieldErrors } from "./_result";
import type { Blockchain, TeamRole } from "@prisma/client";

/**
 * Team / project server actions.
 *
 * Authorization is enforced through `requireTeamRole`. Owners have full
 * control; admins manage members + settings; editors can only touch giveaways
 * (handled in the giveaway actions). Every mutation writes an audit entry.
 */

function checkMutateLimit(userId: string) {
  const rl = rateLimit(`mutate:${userId}`, RATE_LIMITS.mutate.limit, RATE_LIMITS.mutate.windowMs);
  if (!rl.success) {
    throw new AuthzError("You're doing that too fast. Please slow down.", "FORBIDDEN");
  }
}

// --- Create ---------------------------------------------------------------

export async function createTeamAction(
  _prev: ActionState<{ slug: string }>,
  formData: FormData
): Promise<ActionState<{ slug: string }>> {
  const userId = await requireUserId();

  const result = await runAction<{ slug: string }>(async () => {
    checkMutateLimit(userId);

    const parsed = createTeamSchema.safeParse({
      name: formData.get("name"),
      slug: formData.get("slug"),
      description: formData.get("description") || undefined,
    });
    if (!parsed.success) {
      return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
    }

    const { name, slug, description } = parsed.data;

    const taken = await db.team.findUnique({ where: { slug }, select: { id: true } });
    if (taken) {
      return fail("Please fix the errors below.", {
        slug: ["That URL is already taken. Try another."],
      });
    }

    const team = await db.team.create({
      data: {
        name,
        slug,
        description: description || null,
        members: {
          create: { userId, role: "OWNER" },
        },
      },
    });

    await recordAudit({
      teamId: team.id,
      actorId: userId,
      action: "team.create",
      target: team.id,
      meta: { name, slug },
    });

    return ok({ slug });
  });

  if (result.ok && result.data) {
    revalidatePath("/dashboard");
    redirect(`/dashboard/${result.data.slug}`);
  }
  return result;
}

// --- Update settings ------------------------------------------------------

export async function updateTeamAction(
  teamId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();

  return runAction(async () => {
    checkMutateLimit(userId);
    await requireTeamRole(userId, teamId, "ADMIN");

    const chains = formData.getAll("chains").map(String) as Blockchain[];
    const parsed = updateTeamSchema.safeParse({
      name: formData.get("name"),
      description: formData.get("description") || undefined,
      website: formData.get("website") || undefined,
      xHandle: formData.get("xHandle") || undefined,
      discordInvite: formData.get("discordInvite") || undefined,
      discordGuildId: formData.get("discordGuildId") || undefined,
      discordWebhookUrl: formData.get("discordWebhookUrl") || undefined,
      telegram: formData.get("telegram") || undefined,
      logoUrl: formData.get("logoUrl") || undefined,
      bannerUrl: formData.get("bannerUrl") || undefined,
      chains: chains.length ? chains : undefined,
      primaryChain: formData.get("primaryChain") || undefined,
      totalSupply: formData.get("totalSupply") || undefined,
      mintPrice: formData.get("mintPrice") || undefined,
      mintAt: formData.get("mintAt") || undefined,
      mintTba: formData.get("mintTba") || undefined,
    });
    if (!parsed.success) {
      return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
    }

    const d = parsed.data;
    const mintTba = d.mintTba === "true";
    const team = await db.team.update({
      where: { id: teamId },
      data: {
        name: d.name,
        description: emptyToNull(d.description),
        website: emptyToNull(d.website),
        xHandle: emptyToNull(d.xHandle),
        discordInvite: emptyToNull(d.discordInvite),
        discordGuildId: emptyToNull(d.discordGuildId),
        discordWebhookUrl: emptyToNull(d.discordWebhookUrl),
        telegram: emptyToNull(d.telegram),
        logoUrl: emptyToNull(d.logoUrl),
        bannerUrl: emptyToNull(d.bannerUrl),
        chains: (d.chains as Blockchain[]) ?? [],
        primaryChain: d.primaryChain ? (d.primaryChain as Blockchain) : null,
        totalSupply: emptyToNull(d.totalSupply),
        mintPrice: emptyToNull(d.mintPrice),
        mintAt: mintTba ? null : d.mintAt ? new Date(d.mintAt) : null,
        mintTba,
      },
    });

    await recordAudit({
      teamId,
      actorId: userId,
      action: "team.update",
      target: teamId,
    });

    revalidatePath(`/dashboard/${team.slug}`);
    revalidatePath(`/dashboard/${team.slug}/settings`);
    return ok(undefined, "Project settings saved.");
  });
}

// --- Invites --------------------------------------------------------------

export async function inviteMemberAction(
  teamId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();

  return runAction(async () => {
    checkMutateLimit(userId);
    await requireTeamRole(userId, teamId, "ADMIN");

    const parsed = inviteMemberSchema.safeParse({
      email: formData.get("email"),
      role: formData.get("role"),
    });
    if (!parsed.success) {
      return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
    }
    const { email, role } = parsed.data;

    // If the invitee already has an account AND is already a member, no-op.
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await db.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId: existingUser.id } },
      });
      if (existingMember) {
        return fail("That person is already a member of this project.");
      }
    }

    const team = await db.team.findUniqueOrThrow({ where: { id: teamId } });
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

    // Upsert the invite so re-inviting refreshes the token/expiry.
    const invite = await db.teamInvite.upsert({
      where: { teamId_email: { teamId, email } },
      create: { teamId, email, role, token: randomToken(24), expiresAt },
      update: { role, token: randomToken(24), expiresAt, acceptedAt: null },
    });

    await recordAudit({
      teamId,
      actorId: userId,
      action: "member.invite",
      target: invite.id,
      meta: { email, role },
    });

    // Email delivery of the invite link is wired via the email integration in
    // Phase 2; for now the link is shown in the dashboard for copy/paste.
    revalidatePath(`/dashboard/${team.slug}/members`);
    return ok(undefined, `Invite created for ${email}.`);
  });
}

export async function revokeInviteAction(
  teamId: string,
  inviteId: string
): Promise<ActionState> {
  const userId = await requireUserId();
  return runAction(async () => {
    await requireTeamRole(userId, teamId, "ADMIN");
    const team = await db.team.findUniqueOrThrow({ where: { id: teamId } });
    await db.teamInvite.deleteMany({ where: { id: inviteId, teamId } });
    await recordAudit({
      teamId,
      actorId: userId,
      action: "member.invite.revoke",
      target: inviteId,
    });
    revalidatePath(`/dashboard/${team.slug}/members`);
    return ok(undefined, "Invite revoked.");
  });
}

/** Accept an invite by token (invitee must be signed in with the invited email). */
export async function acceptInviteAction(token: string): Promise<ActionState<{ slug: string }>> {
  const userId = await requireUserId();

  return runAction<{ slug: string }>(async () => {
    const invite = await db.teamInvite.findUnique({
      where: { token },
      include: { team: { select: { slug: true } } },
    });
    if (!invite || invite.acceptedAt) {
      return fail("This invite is invalid or has already been used.");
    }
    if (invite.expiresAt < new Date()) {
      return fail("This invite has expired. Ask an admin to send a new one.");
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user?.email || user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return fail("This invite was sent to a different email address.");
    }

    await db.$transaction(async (tx) => {
      await tx.teamMember.upsert({
        where: { teamId_userId: { teamId: invite.teamId, userId } },
        create: { teamId: invite.teamId, userId, role: invite.role },
        update: {}, // already a member — leave role as-is
      });
      await tx.teamInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
    });

    await recordAudit({
      teamId: invite.teamId,
      actorId: userId,
      action: "member.join",
      target: userId,
      meta: { via: "invite" },
    });

    return ok({ slug: invite.team.slug }, "You've joined the project.");
  });
}

// --- Roles & membership ---------------------------------------------------

export async function changeRoleAction(
  teamId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();

  return runAction(async () => {
    const actor = await requireTeamRole(userId, teamId, "ADMIN");

    const parsed = changeRoleSchema.safeParse({
      memberId: formData.get("memberId"),
      role: formData.get("role"),
    });
    if (!parsed.success) {
      return fail("Invalid role change.", zodFieldErrors(parsed.error));
    }
    const { memberId, role } = parsed.data;

    const target = await db.teamMember.findFirst({
      where: { id: memberId, teamId },
    });
    if (!target) return fail("Member not found.");

    // Only owners can grant/revoke the OWNER role or modify another owner.
    if ((role === "OWNER" || target.role === "OWNER") && actor.role !== "OWNER") {
      return fail("Only an owner can change owner roles.");
    }

    // Prevent demoting the last owner (which would orphan the team).
    if (target.role === "OWNER" && role !== "OWNER") {
      const ownerCount = await db.teamMember.count({
        where: { teamId, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        return fail("You can't remove the last owner. Assign another owner first.");
      }
    }

    const team = await db.team.findUniqueOrThrow({ where: { id: teamId } });
    await db.teamMember.update({
      where: { id: memberId },
      data: { role: role as TeamRole },
    });

    await recordAudit({
      teamId,
      actorId: userId,
      action: "member.role_change",
      target: target.userId,
      meta: { from: target.role, to: role },
    });

    revalidatePath(`/dashboard/${team.slug}/members`);
    return ok(undefined, "Role updated.");
  });
}

export async function removeMemberAction(
  teamId: string,
  memberId: string
): Promise<ActionState> {
  const userId = await requireUserId();

  return runAction(async () => {
    const actor = await requireTeamRole(userId, teamId, "ADMIN");
    const target = await db.teamMember.findFirst({
      where: { id: memberId, teamId },
    });
    if (!target) return fail("Member not found.");

    // Admins can't remove owners or other admins unless they're an owner.
    if (!roleAtLeast(actor.role, "OWNER") && roleAtLeast(target.role, "ADMIN")) {
      return fail("Only an owner can remove admins or owners.");
    }
    if (target.role === "OWNER") {
      const ownerCount = await db.teamMember.count({
        where: { teamId, role: "OWNER" },
      });
      if (ownerCount <= 1) return fail("You can't remove the last owner.");
    }

    const team = await db.team.findUniqueOrThrow({ where: { id: teamId } });
    await db.teamMember.delete({ where: { id: memberId } });

    await recordAudit({
      teamId,
      actorId: userId,
      action: "member.remove",
      target: target.userId,
    });

    revalidatePath(`/dashboard/${team.slug}/members`);
    return ok(undefined, "Member removed.");
  });
}

// --- helpers --------------------------------------------------------------

function emptyToNull(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}

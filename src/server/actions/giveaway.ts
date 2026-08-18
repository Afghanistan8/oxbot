"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { requireTeamRole, AuthzError } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { uniqueGiveawaySlug } from "@/lib/slug";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { generateUniqueCodes } from "@/lib/giveaway/codes";
import { FCFS_SENTINEL_END_AT } from "@/lib/format";
import { postGiveawayAnnouncement } from "@/lib/integrations/discord-webhook";
import { absoluteUrl } from "@/lib/utils";
import { CHAIN_META, GIVEAWAY_TYPE_META } from "@/lib/constants";
import {
  giveawayFormSchema,
  type GiveawayFormInput,
  type RequirementInput,
} from "@/lib/validation/giveaway";
import { ActionState, ok, fail, runAction, zodFieldErrors } from "./_result";
import type { GiveawayStatus, Prisma } from "@prisma/client";

/**
 * Giveaway server actions. Creating/editing requires EDITOR+ on the owning team.
 * Publishing computes the initial status from the schedule; ending/cancelling
 * are explicit lifecycle transitions. Every mutation writes an audit entry.
 */

function checkMutateLimit(userId: string) {
  const rl = rateLimit(`mutate:${userId}`, RATE_LIMITS.mutate.limit, RATE_LIMITS.mutate.windowMs);
  if (!rl.success) {
    throw new AuthzError("You're doing that too fast. Please slow down.", "FORBIDDEN");
  }
}

/** Split a validated requirement into its stored columns + JSON config. */
function toRequirementRow(req: RequirementInput, order: number) {
  const { type, required, ...rest } = req;
  // Normalize a leading @ off X handles for consistent downstream comparison.
  const config: Record<string, unknown> = { ...rest };
  if (type === "TWITTER_FOLLOW" && typeof config.handle === "string") {
    config.handle = config.handle.replace(/^@/, "");
  }
  return {
    type,
    required: required ?? true,
    order,
    config: config as Prisma.InputJsonValue,
  };
}

/** Derive the initial status when publishing, based on the schedule. */
function statusForSchedule(startAt: Date, endAt: Date, now = new Date()): GiveawayStatus {
  if (now >= endAt) return "ENDED";
  if (now < startAt) return "SCHEDULED";
  return "ACTIVE";
}

/** Parse the giveaway form payload (core fields + JSON requirements blob). */
function parseGiveawayForm(formData: FormData) {
  let requirements: unknown = [];
  const reqRaw = formData.get("requirements");
  if (typeof reqRaw === "string" && reqRaw.trim()) {
    try {
      requirements = JSON.parse(reqRaw);
    } catch {
      requirements = [];
    }
  }

  return giveawayFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || "",
    prize: formData.get("prize"),
    bannerUrl: formData.get("bannerUrl") || "",
    type: formData.get("type"),
    chain: formData.get("chain"),
    visibility: formData.get("visibility"),
    winnersCount: formData.get("winnersCount"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    hideEntryCount: formData.get("hideEntryCount") === "on" || formData.get("hideEntryCount") === "true",
    xAccount: formData.get("xAccount") || "",
    discordServerId: formData.get("discordServerId") || "",
    telegram: formData.get("telegram") || "",
    requirements,
    generateCodes: formData.get("generateCodes") || 0,
    codePrefix: formData.get("codePrefix") || "",
    codeMaxUses: formData.get("codeMaxUses") || 1,
  });
}

// --- Create ---------------------------------------------------------------

export async function createGiveawayAction(
  teamId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionState<{ slug: string; teamSlug: string; id: string }>> {
  const userId = await requireUserId();
  const publish = formData.get("publish") === "true";

  const result = await runAction<{ slug: string; teamSlug: string; id: string }>(
    async () => {
      checkMutateLimit(userId);
      await requireTeamRole(userId, teamId, "EDITOR");

      const parsed = parseGiveawayForm(formData);
      if (!parsed.success) {
        return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
      }
      const data = parsed.data;
      // FCFS has no author-set end — it closes when all slots are claimed. Store
      // the far-future sentinel so the clock never ends it prematurely.
      if (data.type === "FCFS") data.endAt = FCFS_SENTINEL_END_AT;

      // Guard: can't publish something already past its end.
      if (publish && data.endAt.getTime() <= Date.now()) {
        return fail("End time must be in the future to publish.", {
          endAt: ["End time must be in the future to publish."],
        });
      }

      const team = await db.team.findUniqueOrThrow({
        where: { id: teamId },
        select: { slug: true, name: true, discordWebhookUrl: true },
      });
      const slug = await uniqueGiveawaySlug(data.title);
      const status: GiveawayStatus = publish
        ? statusForSchedule(data.startAt, data.endAt)
        : "DRAFT";

      const requirements = buildRequirements(data);
      const codes = buildCodeRows(data);

      const created = await db.$transaction(async (tx) => {
        const giveaway = await tx.giveaway.create({
          data: {
            teamId,
            slug,
            title: data.title,
            description: data.description || null,
            prize: data.prize,
            bannerUrl: data.bannerUrl || null,
            type: data.type,
            status,
            visibility: data.visibility,
            chain: data.chain,
            winnersCount: data.winnersCount,
            startAt: data.startAt,
            endAt: data.endAt,
            hideEntryCount: data.hideEntryCount,
            xAccount: data.xAccount || null,
            discordServerId: data.discordServerId || null,
            telegram: data.telegram || null,
            createdById: userId,
            requirements: { create: requirements },
          },
        });

        if (codes.length) {
          await tx.entryCode.createMany({
            data: codes.map((c) => ({ ...c, giveawayId: giveaway.id })),
            skipDuplicates: true,
          });
        }

        return giveaway;
      });

      await recordAudit({
        teamId,
        actorId: userId,
        action: "giveaway.create",
        target: created.id,
        meta: { title: data.title, type: data.type, status, published: publish },
      });

      if (publish) {
        await announceGiveaway(team, created);
      }

      return ok({ slug: created.slug, teamSlug: team.slug, id: created.id });
    }
  );

  if (result.ok && result.data) {
    revalidatePath(`/dashboard/${result.data.teamSlug}/giveaways`);
    revalidatePath("/");
    redirect(`/dashboard/${result.data.teamSlug}/giveaways/${result.data.id}`);
  }
  return result;
}

// --- Update ---------------------------------------------------------------

export async function updateGiveawayAction(
  giveawayId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();

  return runAction(async () => {
    checkMutateLimit(userId);
    const giveaway = await db.giveaway.findUnique({
      where: { id: giveawayId },
      include: { team: { select: { slug: true } } },
    });
    if (!giveaway) return fail("Giveaway not found.");
    await requireTeamRole(userId, giveaway.teamId, "EDITOR");

    const parsed = parseGiveawayForm(formData);
    if (!parsed.success) {
      return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
    }
    const data = parsed.data;
    // FCFS closes on slots-claimed, not the clock — keep the sentinel end date.
    if (data.type === "FCFS") data.endAt = FCFS_SENTINEL_END_AT;

    // Once entries exist, requirements are locked to protect fairness.
    const entryCount = await db.entry.count({ where: { giveawayId } });
    const requirements = buildRequirements(data);

    await db.$transaction(async (tx) => {
      await tx.giveaway.update({
        where: { id: giveawayId },
        data: {
          title: data.title,
          description: data.description || null,
          prize: data.prize,
          bannerUrl: data.bannerUrl || null,
          // Type is immutable after creation; ignore any submitted change.
          chain: data.chain,
          visibility: data.visibility,
          winnersCount: data.winnersCount,
          startAt: data.startAt,
          endAt: data.endAt,
          hideEntryCount: data.hideEntryCount,
          xAccount: data.xAccount || null,
          discordServerId: data.discordServerId || null,
          telegram: data.telegram || null,
        },
      });

      if (entryCount === 0) {
        await tx.giveawayRequirement.deleteMany({ where: { giveawayId } });
        if (requirements.length) {
          await tx.giveawayRequirement.createMany({
            data: requirements.map((r) => ({ ...r, giveawayId })),
          });
        }
      }
    });

    await recordAudit({
      teamId: giveaway.teamId,
      actorId: userId,
      action: "giveaway.update",
      target: giveawayId,
      meta: { requirementsLocked: entryCount > 0 },
    });

    revalidatePath(`/dashboard/${giveaway.team.slug}/giveaways/${giveawayId}`);
    revalidatePath(`/giveaways/${giveaway.slug}`);
    return ok(
      undefined,
      entryCount > 0
        ? "Saved. Requirements are locked because entries exist."
        : "Giveaway saved."
    );
  });
}

// --- Lifecycle ------------------------------------------------------------

export async function publishGiveawayAction(giveawayId: string): Promise<ActionState> {
  const userId = await requireUserId();
  return runAction(async () => {
    const giveaway = await db.giveaway.findUnique({
      where: { id: giveawayId },
      include: { team: { select: { slug: true, name: true, discordWebhookUrl: true } } },
    });
    if (!giveaway) return fail("Giveaway not found.");
    await requireTeamRole(userId, giveaway.teamId, "EDITOR");

    if (giveaway.status !== "DRAFT" && giveaway.status !== "SCHEDULED") {
      return fail("Only draft or scheduled giveaways can be published.");
    }
    if (giveaway.endAt.getTime() <= Date.now()) {
      return fail("This giveaway's end time has already passed.");
    }

    const status = statusForSchedule(giveaway.startAt, giveaway.endAt);
    await db.giveaway.update({ where: { id: giveawayId }, data: { status } });

    await recordAudit({
      teamId: giveaway.teamId,
      actorId: userId,
      action: "giveaway.publish",
      target: giveawayId,
      meta: { status },
    });

    await announceGiveaway(giveaway.team, { ...giveaway, status });

    revalidatePath(`/dashboard/${giveaway.team.slug}/giveaways/${giveawayId}`);
    revalidatePath("/");
    return ok(undefined, status === "ACTIVE" ? "Giveaway is live." : "Giveaway scheduled.");
  });
}

export async function endGiveawayAction(giveawayId: string): Promise<ActionState> {
  const userId = await requireUserId();
  return runAction(async () => {
    const giveaway = await db.giveaway.findUnique({
      where: { id: giveawayId },
      include: { team: { select: { slug: true } } },
    });
    if (!giveaway) return fail("Giveaway not found.");
    await requireTeamRole(userId, giveaway.teamId, "EDITOR");

    if (giveaway.status !== "ACTIVE" && giveaway.status !== "SCHEDULED") {
      return fail("Only a live or scheduled giveaway can be ended.");
    }

    await db.giveaway.update({
      where: { id: giveawayId },
      data: { status: "ENDED", endAt: new Date() },
    });

    await recordAudit({
      teamId: giveaway.teamId,
      actorId: userId,
      action: "giveaway.end",
      target: giveawayId,
    });

    revalidatePath(`/dashboard/${giveaway.team.slug}/giveaways/${giveawayId}`);
    revalidatePath("/");
    return ok(undefined, "Giveaway ended. You can now draw winners.");
  });
}

export async function cancelGiveawayAction(giveawayId: string): Promise<ActionState> {
  const userId = await requireUserId();
  return runAction(async () => {
    const giveaway = await db.giveaway.findUnique({
      where: { id: giveawayId },
      include: { team: { select: { slug: true } } },
    });
    if (!giveaway) return fail("Giveaway not found.");
    await requireTeamRole(userId, giveaway.teamId, "ADMIN");

    if (giveaway.status === "FINALIZED") {
      return fail("A finalized giveaway can't be cancelled.");
    }

    await db.giveaway.update({
      where: { id: giveawayId },
      data: { status: "CANCELLED" },
    });

    await recordAudit({
      teamId: giveaway.teamId,
      actorId: userId,
      action: "giveaway.cancel",
      target: giveawayId,
    });

    revalidatePath(`/dashboard/${giveaway.team.slug}/giveaways`);
    revalidatePath("/");
    return ok(undefined, "Giveaway cancelled.");
  });
}

// --- Duplicate ------------------------------------------------------------

export async function duplicateGiveawayAction(
  giveawayId: string
): Promise<ActionState<{ id: string; teamSlug: string }>> {
  const userId = await requireUserId();

  const result = await runAction<{ id: string; teamSlug: string }>(async () => {
    const source = await db.giveaway.findUnique({
      where: { id: giveawayId },
      include: {
        requirements: true,
        team: { select: { slug: true } },
      },
    });
    if (!source) return fail("Giveaway not found.");
    await requireTeamRole(userId, source.teamId, "EDITOR");

    const slug = await uniqueGiveawaySlug(`${source.title} copy`);
    const copy = await db.giveaway.create({
      data: {
        teamId: source.teamId,
        slug,
        title: `${source.title} (copy)`,
        description: source.description,
        prize: source.prize,
        bannerUrl: source.bannerUrl,
        type: source.type,
        status: "DRAFT",
        visibility: source.visibility,
        chain: source.chain,
        winnersCount: source.winnersCount,
        startAt: source.startAt,
        endAt: source.endAt,
        hideEntryCount: source.hideEntryCount,
        xAccount: source.xAccount,
        discordServerId: source.discordServerId,
        telegram: source.telegram,
        createdById: userId,
        requirements: {
          create: source.requirements.map((r) => ({
            type: r.type,
            required: r.required,
            order: r.order,
            config: r.config as Prisma.InputJsonValue,
          })),
        },
      },
    });

    await recordAudit({
      teamId: source.teamId,
      actorId: userId,
      action: "giveaway.duplicate",
      target: copy.id,
      meta: { from: giveawayId },
    });

    return ok({ id: copy.id, teamSlug: source.team.slug });
  });

  if (result.ok && result.data) {
    revalidatePath(`/dashboard/${result.data.teamSlug}/giveaways`);
    redirect(`/dashboard/${result.data.teamSlug}/giveaways/${result.data.id}/edit`);
  }
  return result;
}

// --- helpers --------------------------------------------------------------

function buildRequirements(data: GiveawayFormInput) {
  const rows = data.requirements.map((r, i) => toRequirementRow(r, i));

  // CODE giveaways always need a CODE requirement so entrants are prompted.
  if (data.type === "CODE" && !rows.some((r) => r.type === "CODE")) {
    rows.unshift({
      type: "CODE",
      required: true,
      order: -1,
      config: { caseSensitive: false } as Prisma.InputJsonValue,
    });
    // Re-number so order is stable 0..n.
    rows.forEach((r, i) => (r.order = i));
  }
  return rows;
}

function buildCodeRows(data: GiveawayFormInput) {
  if (data.type !== "CODE" || data.generateCodes <= 0) return [];
  const codes = generateUniqueCodes(data.generateCodes, {
    prefix: data.codePrefix || undefined,
  });
  return codes.map((code) => ({
    code,
    maxUses: data.codeMaxUses,
  }));
}

type AnnouncableGiveaway = {
  slug: string;
  title: string;
  prize: string;
  description: string | null;
  bannerUrl: string | null;
  chain: import("@prisma/client").Blockchain;
  type: import("@prisma/client").GiveawayType;
  visibility: import("@prisma/client").GiveawayVisibility;
  status: GiveawayStatus;
  startAt: Date;
  endAt: Date;
};

/**
 * Best-effort Discord announcement for a just-published giveaway. Never
 * throws — a missing/broken webhook must not block publishing. Skips PRIVATE
 * giveaways outright: announcing a code-gated, invite-only drop to a public
 * channel would defeat the point of it being private.
 */
async function announceGiveaway(
  team: { slug: string; name: string; discordWebhookUrl: string | null },
  giveaway: AnnouncableGiveaway
): Promise<void> {
  if (!team.discordWebhookUrl || giveaway.visibility === "PRIVATE") return;

  const result = await postGiveawayAnnouncement(team.discordWebhookUrl, team.name, {
    title: giveaway.title,
    prize: giveaway.prize,
    description: giveaway.description,
    url: absoluteUrl(`/giveaways/${giveaway.slug}`),
    bannerUrl: giveaway.bannerUrl,
    chainLabel: CHAIN_META[giveaway.chain].label,
    typeLabel: GIVEAWAY_TYPE_META[giveaway.type].label,
    startAt: giveaway.startAt,
    endAt: giveaway.endAt,
    isLive: giveaway.status === "ACTIVE",
    isFcfs: giveaway.type === "FCFS",
  });

  if (!result.ok) {
    console.warn(`[discord-webhook] announcement failed for team ${team.slug}:`, result.error);
  }
}

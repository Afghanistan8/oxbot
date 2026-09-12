"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { requireTeamRole, AuthzError } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { uniqueListingSlug } from "@/lib/slug";
import { InventoryError, assertCapacity, lockListing, resyncListingStatus } from "@/lib/collab/inventory";
import { OPEN_REQUEST_STATUSES } from "@/lib/collab/constants";
import {
  criteriaTemplateSchema,
  listingFormSchema,
  type CriteriaFormInput,
  type ListingFormInput,
} from "@/lib/validation/collab";
import { ActionState, ok, fail, runAction, zodFieldErrors } from "./_result";
import type { Prisma } from "@prisma/client";

/**
 * OxFoxes Collab server actions.
 *
 * Every action: Zod-validates input, authorizes against the acting team's role,
 * is rate-limited per user, and writes an AuditLog entry. Anything that moves
 * spots runs in a transaction that row-locks the listing (lib/collab/inventory).
 */

function checkMutateLimit(userId: string) {
  const rl = rateLimit(`mutate:${userId}`, RATE_LIMITS.mutate.limit, RATE_LIMITS.mutate.windowMs);
  if (!rl.success) {
    throw new AuthzError("You're doing that too fast. Please slow down.", "FORBIDDEN");
  }
}

/** Revalidate every surface a listing appears on. */
function revalidateListing(teamSlug: string, listing: { id: string; slug: string }) {
  revalidatePath(`/dashboard/${teamSlug}/collab`, "layout");
  revalidatePath(`/collab`);
  revalidatePath(`/collab/listings`);
  revalidatePath(`/collab/listings/${listing.slug}`);
}

/** Map validated criteria to DB columns. */
function criteriaColumns(c: CriteriaFormInput) {
  return {
    minCommunitySize: c.minCommunitySize,
    minHolderCount: c.minHolderCount,
    minTwitterFollowers: c.minTwitterFollowers,
    minDiscordMembers: c.minDiscordMembers,
    minRaffleEntries: c.minRaffleEntries,
    requiredChains: c.requiredChains,
    requiredAssetType: c.requiredAssetType,
    requireVerifiedTeam: c.requireVerifiedTeam,
    customRules: c.customRules as unknown as Prisma.InputJsonValue,
  };
}

function parseJsonField(formData: FormData, key: string): unknown {
  const raw = formData.get(key);
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

const bool = (v: FormDataEntryValue | null) => v === "true" || v === "on";

function parseListingForm(formData: FormData) {
  return listingFormSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || "",
    bannerUrl: formData.get("bannerUrl") || "",
    assetType: formData.get("assetType"),
    chain: formData.get("chain"),
    collectionName: formData.get("collectionName") || "",
    collectionAddress: formData.get("collectionAddress") || "",
    tokenSymbol: formData.get("tokenSymbol") || "",
    tokenAddress: formData.get("tokenAddress") || "",
    mintOrTgeAt: formData.get("mintOrTgeAt") || "",
    totalSpots: formData.get("totalSpots"),
    publicSpots: formData.get("publicSpots") || 0,
    spotsPerRequestMin: formData.get("spotsPerRequestMin"),
    spotsPerRequestMax: formData.get("spotsPerRequestMax"),
    distributionMethod: formData.get("distributionMethod"),
    visibility: formData.get("visibility"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    hideRequestCount: bool(formData.get("hideRequestCount")),
    notesPrivate: formData.get("notesPrivate") || "",
    criteria: parseJsonField(formData, "criteria") ?? {},
  });
}

function listingColumns(data: ListingFormInput) {
  const isToken = data.assetType === "TOKEN";
  return {
    title: data.title,
    description: data.description || null,
    bannerUrl: data.bannerUrl || null,
    assetType: data.assetType,
    chain: data.chain,
    collectionName: isToken ? null : data.collectionName || null,
    collectionAddress: isToken ? null : data.collectionAddress || null,
    tokenSymbol: isToken ? data.tokenSymbol || null : null,
    tokenAddress: isToken ? data.tokenAddress || null : null,
    mintOrTgeAt: data.mintOrTgeAt ?? null,
    totalSpots: data.totalSpots,
    publicSpots: data.publicSpots,
    spotsPerRequestMin: data.spotsPerRequestMin,
    spotsPerRequestMax: data.spotsPerRequestMax,
    visibility: data.visibility,
    startAt: data.startAt,
    endAt: data.endAt,
    hideRequestCount: data.hideRequestCount,
    notesPrivate: data.notesPrivate || null,
  };
}

// --- Listings: create / update ----------------------------------------------

export async function createListingAction(
  teamId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionState<{ id: string; teamSlug: string }>> {
  const userId = await requireUserId();
  const publish = formData.get("publish") === "true";

  const result = await runAction<{ id: string; teamSlug: string }>(async () => {
    checkMutateLimit(userId);
    await requireTeamRole(userId, teamId, "EDITOR");

    const parsed = parseListingForm(formData);
    if (!parsed.success) return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
    const data = parsed.data;

    if (publish && data.endAt.getTime() <= Date.now()) {
      return fail("The window must end in the future to publish.", {
        endAt: ["The window must end in the future to publish."],
      });
    }

    const team = await db.team.findUniqueOrThrow({ where: { id: teamId }, select: { slug: true } });
    const slug = await uniqueListingSlug(data.title);

    const listing = await db.whitelistListing.create({
      data: {
        ...listingColumns(data),
        teamId,
        slug,
        distributionMethod: data.distributionMethod,
        status: publish ? "OPEN" : "DRAFT",
        createdById: userId,
        criteria: { create: criteriaColumns(data.criteria) },
      },
    });

    await recordAudit({
      teamId,
      actorId: userId,
      action: "listing.create",
      target: listing.id,
      meta: {
        title: listing.title,
        method: listing.distributionMethod,
        totalSpots: listing.totalSpots,
        publicSpots: listing.publicSpots,
        published: publish,
      },
    });

    revalidateListing(team.slug, listing);
    return ok({ id: listing.id, teamSlug: team.slug });
  });

  if (result.ok && result.data) {
    redirect(`/dashboard/${result.data.teamSlug}/collab/listings/${result.data.id}`);
  }
  return result;
}

export async function updateListingAction(
  listingId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();

  return runAction(async () => {
    checkMutateLimit(userId);
    const existing = await db.whitelistListing.findUnique({
      where: { id: listingId },
      include: {
        team: { select: { slug: true } },
        publicRaffle: { select: { id: true, status: true, _count: { select: { winners: true } } } },
        _count: { select: { requests: true } },
      },
    });
    if (!existing) return fail("Listing not found.");
    await requireTeamRole(userId, existing.teamId, "EDITOR");
    if (existing.status === "CANCELLED") return fail("A cancelled listing can't be edited.");

    const parsed = parseListingForm(formData);
    if (!parsed.success) return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
    const data = parsed.data;

    const raffle = existing.publicRaffle;
    if (raffle && data.publicSpots !== existing.publicSpots) {
      if (raffle.status === "FINALIZED" || raffle._count.winners > 0) {
        return fail("The public raffle has already been drawn — public spots are locked.", {
          publicSpots: ["Locked: the public raffle has been drawn."],
        });
      }
      if (data.publicSpots < 1) {
        return fail("This listing has a public raffle — keep at least 1 public spot, or cancel the raffle first.", {
          publicSpots: ["Keep at least 1 public spot while the raffle exists."],
        });
      }
    }

    // Method is locked once requests exist — changing the rules mid-flight is unfair.
    const methodLocked = existing._count.requests > 0 && data.distributionMethod !== existing.distributionMethod;

    try {
      await db.$transaction(async (tx) => {
        const locked = await lockListing(tx, listingId);
        assertCapacity(locked, data);
        await tx.whitelistListing.update({
          where: { id: listingId },
          data: {
            ...listingColumns(data),
            ...(methodLocked ? {} : { distributionMethod: data.distributionMethod }),
          },
        });
        await tx.listingCriteria.upsert({
          where: { listingId },
          create: { listingId, ...criteriaColumns(data.criteria) },
          update: criteriaColumns(data.criteria),
        });
        if (raffle && data.publicSpots !== existing.publicSpots) {
          await tx.giveaway.update({ where: { id: raffle.id }, data: { winnersCount: data.publicSpots } });
        }
        await resyncListingStatus(tx, listingId);
      });
    } catch (err) {
      if (err instanceof InventoryError) {
        return fail(err.message, { totalSpots: [err.message] });
      }
      throw err;
    }

    await recordAudit({
      teamId: existing.teamId,
      actorId: userId,
      action: "listing.update",
      target: listingId,
      meta: { totalSpots: data.totalSpots, publicSpots: data.publicSpots, methodLocked },
    });

    revalidateListing(existing.team.slug, existing);
    if (raffle) revalidatePath(`/dashboard/${existing.team.slug}/giveaways/${raffle.id}`);
    return ok(
      undefined,
      methodLocked ? "Saved. The distribution method is locked because requests exist." : "Listing saved."
    );
  });
}

// --- Listings: lifecycle ----------------------------------------------------

type LifecycleOp = "publish" | "pause" | "resume" | "close" | "cancel";

const LIFECYCLE_RULES: Record<
  LifecycleOp,
  { from: string[]; to: "OPEN" | "PAUSED" | "CLOSED" | "CANCELLED"; minRole: "EDITOR" | "ADMIN"; message: string }
> = {
  publish: { from: ["DRAFT"], to: "OPEN", minRole: "EDITOR", message: "Listing is open for requests." },
  pause: { from: ["OPEN", "ALLOCATED"], to: "PAUSED", minRole: "EDITOR", message: "Listing paused." },
  resume: { from: ["PAUSED"], to: "OPEN", minRole: "EDITOR", message: "Listing resumed." },
  close: { from: ["OPEN", "PAUSED", "ALLOCATED"], to: "CLOSED", minRole: "EDITOR", message: "Listing closed." },
  cancel: { from: ["DRAFT", "OPEN", "PAUSED", "ALLOCATED", "CLOSED"], to: "CANCELLED", minRole: "ADMIN", message: "Listing cancelled." },
};

async function transitionListing(listingId: string, op: LifecycleOp): Promise<ActionState> {
  const userId = await requireUserId();
  return runAction(async () => {
    checkMutateLimit(userId);
    const rule = LIFECYCLE_RULES[op];
    const listing = await db.whitelistListing.findUnique({
      where: { id: listingId },
      include: { team: { select: { slug: true } } },
    });
    if (!listing) return fail("Listing not found.");
    await requireTeamRole(userId, listing.teamId, rule.minRole);

    if (!rule.from.includes(listing.status)) {
      return fail(`A ${listing.status.toLowerCase()} listing can't be ${op === "publish" ? "published" : `${op}d`}.`);
    }
    if ((op === "publish" || op === "resume") && listing.endAt.getTime() <= Date.now()) {
      return fail("The listing window has already ended — extend the end time first.");
    }
    if (op === "close" && listing.distributionMethod === "RAFFLE" && !listing.drawnAt) {
      const pending = await db.collabRequest.count({
        where: { listingId, status: { in: OPEN_REQUEST_STATUSES }, eligible: true },
      });
      if (pending > 0) {
        return fail("Run the partner raffle draw first — it closes the listing and allocates the winners.");
      }
    }

    let expired = 0;
    await db.$transaction(async (tx) => {
      await lockListing(tx, listingId);
      await tx.whitelistListing.update({ where: { id: listingId }, data: { status: rule.to } });
      if (op === "close" || op === "cancel") {
        const res = await tx.collabRequest.updateMany({
          where: { listingId, status: { in: OPEN_REQUEST_STATUSES } },
          data: { status: "EXPIRED" },
        });
        expired = res.count;
      }
      if (rule.to === "OPEN") await resyncListingStatus(tx, listingId);
    });

    await recordAudit({
      teamId: listing.teamId,
      actorId: userId,
      action: `listing.${op}`,
      target: listingId,
      meta: { from: listing.status, to: rule.to, expiredRequests: expired },
    });

    revalidateListing(listing.team.slug, listing);
    return ok(
      undefined,
      expired > 0 ? `${rule.message} ${expired} pending request${expired === 1 ? "" : "s"} expired.` : rule.message
    );
  });
}

export async function publishListingAction(listingId: string) {
  return transitionListing(listingId, "publish");
}
export async function pauseListingAction(listingId: string) {
  return transitionListing(listingId, "pause");
}
export async function resumeListingAction(listingId: string) {
  return transitionListing(listingId, "resume");
}
export async function closeListingAction(listingId: string) {
  return transitionListing(listingId, "close");
}
export async function cancelListingAction(listingId: string) {
  return transitionListing(listingId, "cancel");
}

// --- Criteria templates ------------------------------------------------------

export async function saveCriteriaTemplateAction(
  teamId: string,
  templateId: string | null,
  _prev: unknown,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  return runAction(async () => {
    checkMutateLimit(userId);
    await requireTeamRole(userId, teamId, "EDITOR");

    const parsed = criteriaTemplateSchema.safeParse({
      name: formData.get("name"),
      criteria: parseJsonField(formData, "criteria") ?? {},
    });
    if (!parsed.success) return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
    const { name, criteria } = parsed.data;

    let id = templateId;
    if (templateId) {
      const existing = await db.listingCriteria.findFirst({
        where: { id: templateId, templateTeamId: teamId, listingId: null },
        select: { id: true },
      });
      if (!existing) return fail("Template not found.");
      await db.listingCriteria.update({ where: { id: templateId }, data: { name, ...criteriaColumns(criteria) } });
    } else {
      const created = await db.listingCriteria.create({
        data: { templateTeamId: teamId, name, ...criteriaColumns(criteria) },
      });
      id = created.id;
    }

    await recordAudit({
      teamId,
      actorId: userId,
      action: "criteria_template.save",
      target: id,
      meta: { name, created: !templateId },
    });

    const team = await db.team.findUniqueOrThrow({ where: { id: teamId }, select: { slug: true } });
    revalidatePath(`/dashboard/${team.slug}/collab/criteria`);
    return ok(undefined, templateId ? "Template updated." : "Template saved.");
  });
}

export async function deleteCriteriaTemplateAction(templateId: string): Promise<ActionState> {
  const userId = await requireUserId();
  return runAction(async () => {
    checkMutateLimit(userId);
    const template = await db.listingCriteria.findUnique({
      where: { id: templateId },
      include: { templateTeam: { select: { slug: true } } },
    });
    if (!template?.templateTeamId || template.listingId) return fail("Template not found.");
    await requireTeamRole(userId, template.templateTeamId, "EDITOR");

    await db.listingCriteria.delete({ where: { id: templateId } });
    await recordAudit({
      teamId: template.templateTeamId,
      actorId: userId,
      action: "criteria_template.delete",
      target: templateId,
      meta: { name: template.name },
    });

    revalidatePath(`/dashboard/${template.templateTeam?.slug}/collab/criteria`);
    return ok(undefined, "Template deleted.");
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { requireTeamRole, AuthzError } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { uniqueGiveawaySlug, uniqueListingSlug } from "@/lib/slug";
import { FCFS_SENTINEL_END_AT } from "@/lib/format";
import { requirementSchema } from "@/lib/validation/giveaway";
import { publishGiveawayAction } from "@/server/actions/giveaway";
import {
  InventoryError,
  assertCapacity,
  lockListing,
  resyncListingStatus,
  transitionAllocation,
} from "@/lib/collab/inventory";
import { OPEN_REQUEST_STATUSES } from "@/lib/collab/constants";
import { criteriaFromRow, evaluateEligibility } from "@/lib/collab/eligibility";
import { RequestRuleError, approveRequest, drawPartnerRaffle, fileRequest } from "@/lib/collab/requests";
import { notifyRequestDecision } from "@/lib/collab/notify";
import { generateDrawSeed } from "@/lib/giveaway/winner-selection";
import { getTeamPlatformFacts } from "@/server/queries/collab";
import {
  allocationWalletsSchema,
  criteriaTemplateSchema,
  listingFormSchema,
  parseWalletLines,
  requestFormSchema,
  requesterReplySchema,
  reviewDecisionSchema,
  type CriteriaFormInput,
  type ListingFormInput,
} from "@/lib/validation/collab";
import { ActionState, ok, fail, runAction, zodFieldErrors } from "./_result";
import type { Prisma, RequestStatus } from "@prisma/client";

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
    await requireTeamRole(userId, teamId, "COLLAB_MANAGER");

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
    await requireTeamRole(userId, existing.teamId, "COLLAB_MANAGER");
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
    await requireTeamRole(userId, teamId, "COLLAB_MANAGER");

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
    await requireTeamRole(userId, template.templateTeamId, "COLLAB_MANAGER");

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

// --- Partner requests: file ---------------------------------------------------

export type SubmitRequestResult = {
  requestId: string;
  status: RequestStatus;
  spotsGranted: number | null;
  teamSlug: string;
};

export async function submitRequestAction(
  listingId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionState<SubmitRequestResult>> {
  const userId = await requireUserId();

  return runAction<SubmitRequestResult>(async () => {
    const rl = rateLimit(`collab-request:${userId}`, 6, 60_000);
    if (!rl.success) return fail(`Too many requests. Try again in ${rl.retryAfter}s.`);

    const parsed = requestFormSchema.safeParse({
      requesterTeamId: formData.get("requesterTeamId"),
      spotsRequested: formData.get("spotsRequested"),
      pitch: formData.get("pitch"),
      audienceSummary: formData.get("audienceSummary") || "",
      communityName: formData.get("communityName") ?? "",
      communityX: formData.get("communityX") ?? "",
      communityDiscord: formData.get("communityDiscord") ?? "",
      communityTelegram: formData.get("communityTelegram") ?? "",
      communityTiktok: formData.get("communityTiktok") ?? "",
      communityInstagram: formData.get("communityInstagram") ?? "",
      reportedRaffleEntries: formData.get("reportedRaffleEntries"),
      contactName: formData.get("contactName") ?? "",
      contactEmail: formData.get("contactEmail") ?? "",
      contactX: formData.get("contactX") ?? "",
      contactDiscord: formData.get("contactDiscord") ?? "",
      contactTelegram: formData.get("contactTelegram") ?? "",
      communitySize: formData.get("communitySize"),
      holderCount: formData.get("holderCount"),
      twitterFollowers: formData.get("twitterFollowers"),
      discordMembers: formData.get("discordMembers"),
      requesterChains: formData.getAll("requesterChains").map(String),
      requesterAssetType: formData.get("requesterAssetType") || null,
      evidenceLinks: formData.getAll("evidenceLinks").map(String).filter((s) => s.trim()),
      attestations: formData.getAll("attestations").map(String),
      walletForDelivery: formData.get("walletForDelivery") || "",
      deliveryChain: formData.get("deliveryChain") || "",
    });
    if (!parsed.success) return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
    const data = parsed.data;

    await requireTeamRole(userId, data.requesterTeamId, "COLLAB_MANAGER");

    const listing = await db.whitelistListing.findUnique({
      where: { id: listingId },
      include: { criteria: true, team: { select: { id: true, slug: true, name: true } } },
    });
    if (!listing || listing.status === "DRAFT") return fail("Listing not found.");

    // Only rules the listing actually defines can be attested.
    const criteria = criteriaFromRow(listing.criteria);
    const ruleIds = new Set(criteria?.customRules.map((r) => r.id) ?? []);
    const attestations: Record<string, boolean> = {};
    for (const id of data.attestations) if (ruleIds.has(id)) attestations[id] = true;

    const facts = (await getTeamPlatformFacts([data.requesterTeamId])).get(data.requesterTeamId) ?? {
      raffleEntries: 0,
      verifiedTeam: false,
    };
    const eligibility = evaluateEligibility(criteria, {
      communitySize: data.communitySize,
      holderCount: data.holderCount,
      twitterFollowers: data.twitterFollowers,
      discordMembers: data.discordMembers,
      raffleEntries: facts.raffleEntries,
      chains: data.requesterChains,
      assetType: data.requesterAssetType,
      verifiedTeam: facts.verifiedTeam,
      attestations,
    });

    let outcome;
    try {
      outcome = await fileRequest(db, {
        listingId,
        requesterTeamId: data.requesterTeamId,
        submittedById: userId,
        spotsRequested: data.spotsRequested,
        pitch: data.pitch,
        audienceSummary: data.audienceSummary || null,
        communitySize: data.communitySize,
        holderCount: data.holderCount,
        twitterFollowers: data.twitterFollowers,
        discordMembers: data.discordMembers,
        community: {
          communityName: data.communityName,
          communityX: data.communityX,
          communityDiscord: data.communityDiscord,
          communityTelegram: data.communityTelegram,
          communityTiktok: data.communityTiktok,
          communityInstagram: data.communityInstagram,
          reportedRaffleEntries: data.reportedRaffleEntries,
          contactName: data.contactName,
          contactEmail: data.contactEmail,
          contactX: data.contactX,
          contactDiscord: data.contactDiscord,
          contactTelegram: data.contactTelegram,
        },
        requesterChains: data.requesterChains,
        requesterAssetType: data.requesterAssetType,
        evidence: { links: data.evidenceLinks, attestations },
        walletForDelivery: data.walletForDelivery || null,
        deliveryChain: data.deliveryChain || null,
        eligibility,
      });
    } catch (err) {
      if (err instanceof RequestRuleError || err instanceof InventoryError) return fail(err.message);
      throw err;
    }

    const requester = await db.team.findUniqueOrThrow({
      where: { id: data.requesterTeamId },
      select: { slug: true, name: true, discordWebhookUrl: true },
    });
    const meta = {
      listing: listing.title,
      requester: requester.name,
      spotsRequested: data.spotsRequested,
      status: outcome.request.status,
      eligible: eligibility.eligible,
      score: eligibility.score,
    };
    await Promise.all([
      recordAudit({ teamId: data.requesterTeamId, actorId: userId, action: "request.submit", target: outcome.request.id, meta }),
      recordAudit({
        teamId: listing.teamId,
        actorId: userId,
        action: outcome.autoApproved ? "request.auto_approve" : "request.submit",
        target: outcome.request.id,
        meta: { ...meta, allocationId: outcome.allocationId },
      }),
    ]);

    if (outcome.autoApproved) {
      const submitter = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
      await notifyRequestDecision({
        decision: "approved",
        to: submitter?.email ?? null,
        requesterTeam: requester,
        listingTeam: listing.team,
        listing,
        spotsGranted: outcome.request.spotsGranted,
      });
    }

    revalidateListing(listing.team.slug, listing);
    revalidatePath(`/dashboard/${requester.slug}/collab`, "layout");

    const messages: Partial<Record<RequestStatus, string>> = {
      APPROVED: `Approved instantly — ${outcome.request.spotsGranted} spots are yours. Submit delivery wallets from your desk.`,
      WAITLISTED: "No partner spots left right now — you're on the waitlist.",
      UNDER_REVIEW: "Request filed. You meet the criteria — it's in their review queue.",
      SUBMITTED: eligibility.eligible
        ? "Request filed."
        : "Request filed, but it's flagged as below this listing's criteria.",
    };
    return ok(
      {
        requestId: outcome.request.id,
        status: outcome.request.status,
        spotsGranted: outcome.request.spotsGranted,
        teamSlug: requester.slug,
      },
      messages[outcome.request.status] ?? "Request filed."
    );
  });
}

// --- Partner requests: review (listing team) ---------------------------------

async function loadRequestForListingTeam(requestId: string, userId: string) {
  const request = await db.collabRequest.findUnique({
    where: { id: requestId },
    include: {
      listing: { include: { team: { select: { id: true, slug: true, name: true } } } },
      requesterTeam: { select: { id: true, slug: true, name: true, discordWebhookUrl: true } },
      submittedBy: { select: { email: true } },
    },
  });
  if (!request) throw new AuthzError("Request not found.", "NOT_FOUND");
  await requireTeamRole(userId, request.listing.teamId, "COLLAB_MANAGER");
  return request;
}

export async function reviewRequestAction(
  requestId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();

  return runAction(async () => {
    checkMutateLimit(userId);
    const request = await loadRequestForListingTeam(requestId, userId);

    const parsed = reviewDecisionSchema.safeParse({
      decision: formData.get("decision"),
      spotsGranted: formData.get("spotsGranted") ?? undefined,
      note: formData.get("note") || "",
    });
    if (!parsed.success) return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
    const decision = parsed.data;
    const note = decision.note || null;

    if (!OPEN_REQUEST_STATUSES.includes(request.status)) {
      return fail("This request has already been decided.");
    }

    const { listing } = request;
    if (decision.decision === "approve") {
      try {
        const result = await approveRequest(db, {
          requestId,
          spotsGranted: decision.spotsGranted,
          reviewerId: userId,
          note,
        });
        await recordAudit({
          teamId: listing.teamId,
          actorId: userId,
          action: "request.approve",
          target: requestId,
          meta: {
            requester: request.requesterTeam.name,
            spotsRequested: request.spotsRequested,
            spotsGranted: decision.spotsGranted,
            partial: result.request.status === "PARTIALLY_APPROVED",
            allocationId: result.allocationId,
          },
        });
      } catch (err) {
        if (err instanceof RequestRuleError || err instanceof InventoryError) {
          return fail(err.message, { spotsGranted: [err.message] });
        }
        throw err;
      }
    } else {
      const status: RequestStatus =
        decision.decision === "reject" ? "REJECTED" : decision.decision === "needs_info" ? "NEEDS_INFO" : "WAITLISTED";
      const claimed = await db.collabRequest.updateMany({
        where: { id: requestId, status: { in: OPEN_REQUEST_STATUSES } },
        data: { status, reviewerNote: note, reviewedById: userId, reviewedAt: new Date() },
      });
      if (claimed.count === 0) return fail("This request has already been decided.");
      await recordAudit({
        teamId: listing.teamId,
        actorId: userId,
        action: decision.decision === "reject" ? "request.reject" : decision.decision === "needs_info" ? "request.needs_info" : "request.waitlist",
        target: requestId,
        meta: { requester: request.requesterTeam.name, note },
      });
    }

    await notifyRequestDecision({
      decision:
        decision.decision === "approve"
          ? "approved"
          : decision.decision === "reject"
            ? "rejected"
            : decision.decision === "needs_info"
              ? "needs_info"
              : "waitlisted",
      to: request.submittedBy?.email ?? null,
      requesterTeam: request.requesterTeam,
      listingTeam: listing.team,
      listing,
      spotsGranted: decision.decision === "approve" ? decision.spotsGranted : null,
      note,
    });

    revalidateListing(listing.team.slug, listing);
    revalidatePath(`/dashboard/${request.requesterTeam.slug}/collab`, "layout");

    const messages = {
      approve: "Approved — spots reserved for the partner.",
      reject: "Request rejected.",
      needs_info: "Asked the requester for more info.",
      waitlist: "Request waitlisted.",
    } as const;
    return ok(undefined, messages[decision.decision]);
  });
}

/** RAFFLE listings: draw qualified requester teams with a stored CSPRNG seed. */
export async function drawPartnerRaffleAction(listingId: string): Promise<ActionState<{ winners: number }>> {
  const userId = await requireUserId();

  return runAction<{ winners: number }>(async () => {
    checkMutateLimit(userId);
    const listing = await db.whitelistListing.findUnique({
      where: { id: listingId },
      include: { team: { select: { id: true, slug: true, name: true } } },
    });
    if (!listing) return fail("Listing not found.");
    await requireTeamRole(userId, listing.teamId, "COLLAB_MANAGER");

    const seed = generateDrawSeed();
    let result;
    try {
      result = await drawPartnerRaffle(db, { listingId, seed, reviewerId: userId });
    } catch (err) {
      if (err instanceof RequestRuleError || err instanceof InventoryError) return fail(err.message);
      throw err;
    }

    await recordAudit({
      teamId: listing.teamId,
      actorId: userId,
      action: "partner_raffle.draw",
      target: listingId,
      meta: {
        seed,
        winners: result.winners.length,
        spots: result.winners.reduce((n, w) => n + w.spots, 0),
        waitlisted: result.waitlisted,
        expired: result.expired,
      },
    });

    if (result.winners.length) {
      const requests = await db.collabRequest.findMany({
        where: { id: { in: result.winners.map((w) => w.requestId) } },
        include: {
          requesterTeam: { select: { slug: true, name: true, discordWebhookUrl: true } },
          submittedBy: { select: { email: true } },
        },
      });
      await Promise.all(
        requests.map((r) =>
          notifyRequestDecision({
            decision: "raffle_won",
            to: r.submittedBy?.email ?? null,
            requesterTeam: r.requesterTeam,
            listingTeam: listing.team,
            listing,
            spotsGranted: r.spotsGranted,
          })
        )
      );
    }

    revalidateListing(listing.team.slug, listing);
    const n = result.winners.length;
    return ok(
      { winners: n },
      n === 0 ? "Drawn — no qualified requests could be allocated." : `Drew ${n} partner${n === 1 ? "" : "s"}. The listing is now closed.`
    );
  });
}

// --- Partner requests: requester side ----------------------------------------

async function loadRequestForRequesterTeam(requestId: string, userId: string) {
  const request = await db.collabRequest.findUnique({
    where: { id: requestId },
    include: {
      listing: { include: { team: { select: { id: true, slug: true, name: true } } } },
      requesterTeam: { select: { id: true, slug: true, name: true } },
      allocation: true,
    },
  });
  if (!request) throw new AuthzError("Request not found.", "NOT_FOUND");
  await requireTeamRole(userId, request.requesterTeamId, "COLLAB_MANAGER");
  return request;
}

export async function replyToRequestAction(
  requestId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  return runAction(async () => {
    checkMutateLimit(userId);
    const request = await loadRequestForRequesterTeam(requestId, userId);
    const parsed = requesterReplySchema.safeParse({ reply: formData.get("reply") });
    if (!parsed.success) return fail("Please fix the errors below.", zodFieldErrors(parsed.error));

    const claimed = await db.collabRequest.updateMany({
      where: { id: requestId, status: "NEEDS_INFO" },
      data: {
        requesterReply: parsed.data.reply,
        status: request.eligible && request.listing.distributionMethod === "CRITERIA" ? "UNDER_REVIEW" : "SUBMITTED",
      },
    });
    if (claimed.count === 0) return fail("This request isn't waiting on a reply.");

    await Promise.all([
      recordAudit({ teamId: request.requesterTeamId, actorId: userId, action: "request.reply", target: requestId }),
      recordAudit({ teamId: request.listing.teamId, actorId: userId, action: "request.reply", target: requestId, meta: { requester: request.requesterTeam.name } }),
    ]);
    revalidatePath(`/dashboard/${request.requesterTeam.slug}/collab`, "layout");
    revalidatePath(`/dashboard/${request.listing.team.slug}/collab`, "layout");
    return ok(undefined, "Reply sent — your request is back in their queue.");
  });
}

/**
 * Withdraw a request. An approved request whose spots are still only RESERVED
 * can be declined too — the spots return to the listing's inventory.
 */
export async function cancelRequestAction(requestId: string): Promise<ActionState> {
  const userId = await requireUserId();
  return runAction(async () => {
    checkMutateLimit(userId);
    const request = await loadRequestForRequesterTeam(requestId, userId);

    const isOpen = OPEN_REQUEST_STATUSES.includes(request.status);
    const declinable =
      (request.status === "APPROVED" || request.status === "PARTIALLY_APPROVED") &&
      request.allocation?.status === "RESERVED";
    if (!isOpen && !declinable) {
      return fail(
        request.allocation && request.allocation.status !== "REVOKED"
          ? "Confirmed spots can't be withdrawn here — ask the listing team to revoke them."
          : "This request can't be withdrawn."
      );
    }

    try {
      await db.$transaction(async (tx) => {
        const listing = await lockListing(tx, request.listingId);
        const claimed = await tx.collabRequest.updateMany({
          where: { id: requestId, status: request.status },
          data: { status: "CANCELLED" },
        });
        if (claimed.count === 0) throw new RequestRuleError("This request just changed — refresh and try again.");
        if (declinable && request.allocation) {
          await transitionAllocation(tx, listing, request.allocation, "REVOKED", { note: "Declined by the partner." });
        }
      });
    } catch (err) {
      if (err instanceof RequestRuleError || err instanceof InventoryError) return fail(err.message);
      throw err;
    }

    await Promise.all([
      recordAudit({ teamId: request.requesterTeamId, actorId: userId, action: "request.cancel", target: requestId, meta: { declinedSpots: declinable } }),
      recordAudit({ teamId: request.listing.teamId, actorId: userId, action: "request.cancel", target: requestId, meta: { requester: request.requesterTeam.name, declinedSpots: declinable } }),
    ]);
    revalidateListing(request.listing.team.slug, request.listing);
    revalidatePath(`/dashboard/${request.requesterTeam.slug}/collab`, "layout");
    return ok(undefined, declinable ? "Allocation declined — the spots went back to the listing." : "Request withdrawn.");
  });
}

// --- Allocations: delivery ----------------------------------------------------

/** Receiving team pastes its delivery wallets; a RESERVED allocation becomes CONFIRMED. */
export async function submitAllocationWalletsAction(
  allocationId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionState> {
  const userId = await requireUserId();
  return runAction(async () => {
    checkMutateLimit(userId);
    const allocation = await db.collabAllocation.findUnique({
      where: { id: allocationId },
      include: {
        listing: { include: { team: { select: { slug: true } } } },
        team: { select: { slug: true, name: true } },
      },
    });
    if (!allocation) return fail("Allocation not found.");
    await requireTeamRole(userId, allocation.teamId, "COLLAB_MANAGER");
    if (allocation.status === "REVOKED" || allocation.status === "DELIVERED") {
      return fail(`This allocation is already ${allocation.status.toLowerCase()}.`);
    }

    const wallets = parseWalletLines(String(formData.get("wallets") ?? ""), allocation.listing.chain);
    const parsed = allocationWalletsSchema.safeParse({ wallets });
    if (!parsed.success) return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
    if (parsed.data.wallets.length > allocation.spots) {
      return fail(`You were granted ${allocation.spots} spots — paste at most ${allocation.spots} wallets.`, {
        wallets: [`At most ${allocation.spots} wallets.`],
      });
    }

    try {
      await db.$transaction(async (tx) => {
        const listing = await lockListing(tx, allocation.listingId);
        const fresh = await tx.collabAllocation.findUniqueOrThrow({ where: { id: allocationId } });
        const walletJson = parsed.data.wallets as unknown as Prisma.InputJsonValue;
        if (fresh.status === "RESERVED") {
          await transitionAllocation(tx, listing, fresh, "CONFIRMED", { wallets: walletJson });
        } else if (fresh.status === "CONFIRMED") {
          await tx.collabAllocation.update({ where: { id: allocationId }, data: { wallets: walletJson } });
        } else {
          throw new InventoryError(`This allocation is already ${fresh.status.toLowerCase()}.`);
        }
      });
    } catch (err) {
      if (err instanceof InventoryError) return fail(err.message);
      throw err;
    }

    await Promise.all([
      recordAudit({ teamId: allocation.teamId, actorId: userId, action: "allocation.wallets", target: allocationId, meta: { wallets: wallets.length } }),
      recordAudit({ teamId: allocation.listing.teamId, actorId: userId, action: "allocation.wallets", target: allocationId, meta: { partner: allocation.team.name, wallets: wallets.length } }),
    ]);
    revalidatePath(`/dashboard/${allocation.team.slug}/collab`, "layout");
    revalidatePath(`/dashboard/${allocation.listing.team.slug}/collab`, "layout");
    return ok(undefined, `${wallets.length} wallet${wallets.length === 1 ? "" : "s"} submitted — spots confirmed.`);
  });
}

/** Listing team moves an allocation along: confirm, mark delivered, or revoke. */
export async function setAllocationStatusAction(
  allocationId: string,
  to: "CONFIRMED" | "DELIVERED" | "REVOKED"
): Promise<ActionState> {
  const userId = await requireUserId();
  return runAction(async () => {
    checkMutateLimit(userId);
    const target = z.enum(["CONFIRMED", "DELIVERED", "REVOKED"]).parse(to);
    const allocation = await db.collabAllocation.findUnique({
      where: { id: allocationId },
      include: {
        listing: { include: { team: { select: { slug: true } } } },
        team: { select: { slug: true, name: true } },
      },
    });
    if (!allocation) return fail("Allocation not found.");
    await requireTeamRole(userId, allocation.listing.teamId, target === "REVOKED" ? "ADMIN" : "COLLAB_MANAGER");

    try {
      await db.$transaction(async (tx) => {
        const listing = await lockListing(tx, allocation.listingId);
        const fresh = await tx.collabAllocation.findUniqueOrThrow({ where: { id: allocationId } });
        await transitionAllocation(tx, listing, fresh, target);
      });
    } catch (err) {
      if (err instanceof InventoryError) return fail(err.message);
      throw err;
    }

    const action = target === "CONFIRMED" ? "allocation.confirm" : target === "DELIVERED" ? "allocation.deliver" : "allocation.revoke";
    await Promise.all([
      recordAudit({ teamId: allocation.listing.teamId, actorId: userId, action, target: allocationId, meta: { partner: allocation.team.name, spots: allocation.spots } }),
      recordAudit({ teamId: allocation.teamId, actorId: userId, action, target: allocationId, meta: { spots: allocation.spots } }),
    ]);
    revalidateListing(allocation.listing.team.slug, allocation.listing);
    revalidatePath(`/dashboard/${allocation.team.slug}/collab`, "layout");
    const messages = { CONFIRMED: "Allocation confirmed.", DELIVERED: "Marked as delivered.", REVOKED: "Allocation revoked — spots returned to inventory." };
    return ok(undefined, messages[target]);
  });
}

// --- Public whitelist raffle (a normal giveaway linked to the listing) --------

const publicRaffleSchema = z
  .object({
    type: z.enum(["RANDOM", "FCFS"]),
    startAt: z.coerce.date({ message: "Pick a start time." }),
    endAt: z.coerce.date({ message: "Pick an end time." }),
    requirements: z.array(requirementSchema).max(12).default([]),
  })
  .refine((d) => d.type === "FCFS" || d.endAt.getTime() > d.startAt.getTime(), {
    message: "The raffle must end after it starts.",
    path: ["endAt"],
  });

/**
 * Open the public raffle for a listing's `publicSpots`: creates a Giveaway
 * linked by `listingId` (winners = public spots, prize "GTD whitelist x N")
 * that runs on the existing entry engine, seeded draw and winners export.
 * Publishing goes through the standard giveaway publish action so the Discord
 * announcement and audit trail are identical to any other giveaway.
 */
export async function openPublicRaffleAction(
  listingId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionState<{ giveawayId: string; teamSlug: string }>> {
  const userId = await requireUserId();
  const publish = formData.get("publish") === "true";

  const result = await runAction<{ giveawayId: string; teamSlug: string }>(async () => {
    checkMutateLimit(userId);
    const listing = await db.whitelistListing.findUnique({
      where: { id: listingId },
      include: {
        team: { select: { id: true, slug: true, name: true, xHandle: true, discordGuildId: true, bannerUrl: true } },
        publicRaffle: { select: { id: true } },
      },
    });
    if (!listing) return fail("Listing not found.");
    await requireTeamRole(userId, listing.teamId, "COLLAB_MANAGER");

    if (listing.status === "CANCELLED") return fail("This listing was cancelled.");
    if (listing.publicRaffle) return fail("This listing already has a public raffle.");
    if (listing.publicSpots < 1) {
      return fail("Set aside public spots on the listing first (Edit → Spots → Public raffle slice).");
    }

    const parsed = publicRaffleSchema.safeParse({
      type: formData.get("type"),
      startAt: formData.get("startAt"),
      endAt: formData.get("endAt"),
      requirements: parseJsonField(formData, "requirements") ?? [],
    });
    if (!parsed.success) return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
    const data = parsed.data;
    const endAt = data.type === "FCFS" ? FCFS_SENTINEL_END_AT : data.endAt;
    if (publish && endAt.getTime() <= Date.now()) {
      return fail("The raffle must end in the future to publish.", { endAt: ["Pick a future end time."] });
    }

    const usesDiscord = data.requirements.some((r) => r.type === "DISCORD_MEMBER" || r.type === "DISCORD_ROLE");
    if (usesDiscord && !listing.team.discordGuildId) {
      return fail("Link your Discord server in project settings to use a Discord task.");
    }

    const spots = listing.publicSpots;
    const slug = await uniqueGiveawaySlug(`${listing.team.name} public wl`);
    const giveaway = await db.giveaway.create({
      data: {
        teamId: listing.teamId,
        listingId: listing.id,
        slug,
        title: `${listing.team.name} Public WL`,
        description: [
          `${spots} guaranteed whitelist spot${spots === 1 ? "" : "s"} for ${listing.collectionName ?? listing.tokenSymbol ?? listing.title}, open to everyone.`,
          listing.description,
        ]
          .filter(Boolean)
          .join("\n\n"),
        prize: `GTD whitelist x ${spots}`,
        bannerUrl: listing.bannerUrl ?? listing.team.bannerUrl,
        type: data.type,
        status: "DRAFT",
        visibility: "PUBLIC",
        chain: listing.chain,
        winnersCount: spots,
        startAt: data.startAt,
        endAt,
        xAccount: listing.team.xHandle,
        discordServerId: listing.team.discordGuildId,
        createdById: userId,
        requirements: {
          create: data.requirements.map((r, i) => {
            const { type, required, ...rest } = r;
            const config: Record<string, unknown> = { ...rest };
            if (type === "TWITTER_FOLLOW" && typeof config.handle === "string") {
              config.handle = config.handle.replace(/^@/, "");
            }
            return { type, required: required ?? true, order: i, config: config as Prisma.InputJsonValue };
          }),
        },
      },
    });

    await Promise.all([
      recordAudit({
        teamId: listing.teamId,
        actorId: userId,
        action: "listing.raffle_open",
        target: listing.id,
        meta: { giveawayId: giveaway.id, spots, type: data.type, tasks: data.requirements.map((r) => r.type) },
      }),
      recordAudit({
        teamId: listing.teamId,
        actorId: userId,
        action: "giveaway.create",
        target: giveaway.id,
        meta: { title: giveaway.title, type: giveaway.type, listingId: listing.id, published: publish },
      }),
    ]);

    if (publish) {
      const published = await publishGiveawayAction(giveaway.id);
      if (!published.ok) {
        return fail(`Raffle created as a draft, but publishing failed: ${published.error ?? "unknown error"}`);
      }
    }

    revalidateListing(listing.team.slug, listing);
    revalidatePath(`/dashboard/${listing.team.slug}/giveaways`);
    return ok({ giveawayId: giveaway.id, teamSlug: listing.team.slug });
  });

  if (result.ok && result.data) {
    redirect(`/dashboard/${result.data.teamSlug}/giveaways/${result.data.giveawayId}`);
  }
  return result;
}

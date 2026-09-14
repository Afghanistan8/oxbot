"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { requireTeamRole, AuthzError } from "@/lib/authz";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { recordAudit } from "@/lib/audit";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { uniqueListingSlug } from "@/lib/slug";
import {
  InventoryError,
  assertCapacity,
  lockListing,
  resyncListingStatus,
  transitionAllocation,
} from "@/lib/collab/inventory";
import { OPEN_REQUEST_STATUSES } from "@/lib/collab/constants";
import { RequestRuleError, approveRequest, fileRequest } from "@/lib/collab/requests";
import { notifyRequestDecision } from "@/lib/collab/notify";
import {
  adminRequestFormSchema,
  allocationWalletsSchema,
  listingFormSchema,
  parseWalletLines,
  requestFormSchema,
  requesterReplySchema,
  reviewDecisionSchema,
  type ListingFormInput,
} from "@/lib/validation/collab";
import { ActionState, ok, fail, runAction, zodFieldErrors } from "./_result";
import type { Prisma, RequestStatus } from "@prisma/client";

/**
 * OxFoxes Collab server actions.
 *
 * Every action: Zod-validates input, authorizes against the acting team's role
 * (or platform-admin status), is rate-limited per user, and writes an
 * AuditLog entry. Anything that moves spots runs in a transaction that
 * row-locks the listing (lib/collab/inventory).
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
    spotsPerRequestMin: formData.get("spotsPerRequestMin"),
    spotsPerRequestMax: formData.get("spotsPerRequestMax"),
    visibility: formData.get("visibility"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    hideRequestCount: bool(formData.get("hideRequestCount")),
    notesPrivate: formData.get("notesPrivate") || "",
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
        status: publish ? "OPEN" : "DRAFT",
        createdById: userId,
      },
    });

    await recordAudit({
      teamId,
      actorId: userId,
      action: "listing.create",
      target: listing.id,
      meta: { title: listing.title, totalSpots: listing.totalSpots, published: publish },
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
      },
    });
    if (!existing) return fail("Listing not found.");
    await requireTeamRole(userId, existing.teamId, "COLLAB_MANAGER");
    if (existing.status === "CANCELLED") return fail("A cancelled listing can't be edited.");

    const parsed = parseListingForm(formData);
    if (!parsed.success) return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
    const data = parsed.data;

    try {
      await db.$transaction(async (tx) => {
        const locked = await lockListing(tx, listingId);
        assertCapacity(locked, data);
        await tx.whitelistListing.update({
          where: { id: listingId },
          data: listingColumns(data),
        });
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
      meta: { totalSpots: data.totalSpots },
    });

    revalidateListing(existing.team.slug, existing);
    return ok(undefined, "Listing saved.");
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

// --- Partner requests: file ---------------------------------------------------

export type SubmitRequestResult = {
  requestId: string;
  status: RequestStatus;
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
      communityName: formData.get("communityName") ?? "",
      communitySize: formData.get("communitySize"),
      communityX: formData.get("communityX") ?? "",
      communityDiscord: formData.get("communityDiscord") ?? "",
      communityTelegram: formData.get("communityTelegram") ?? "",
      raffleProofImageUrl: formData.get("raffleProofImageUrl") || "",
      contactName: formData.get("contactName") ?? "",
      contactMethod: formData.get("contactMethod"),
      contactHandle: formData.get("contactHandle") ?? "",
    });
    if (!parsed.success) return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
    const data = parsed.data;

    await requireTeamRole(userId, data.requesterTeamId, "COLLAB_MANAGER");

    const listing = await db.whitelistListing.findUnique({
      where: { id: listingId },
      include: { team: { select: { id: true, slug: true, name: true } } },
    });
    if (!listing || listing.status === "DRAFT") return fail("Listing not found.");

    let outcome;
    try {
      outcome = await fileRequest(db, {
        listingId,
        requesterTeamId: data.requesterTeamId,
        submittedById: userId,
        addedByAdminId: null,
        spotsRequested: data.spotsRequested,
        communityName: data.communityName,
        communitySize: data.communitySize,
        communityX: data.communityX,
        communityDiscord: data.communityDiscord || null,
        communityTelegram: data.communityTelegram || null,
        raffleProofImageUrl: data.raffleProofImageUrl || null,
        contactName: data.contactName,
        contactMethod: data.contactMethod,
        contactHandle: data.contactHandle,
      });
    } catch (err) {
      if (err instanceof RequestRuleError || err instanceof InventoryError) return fail(err.message);
      throw err;
    }

    const requester = await db.team.findUniqueOrThrow({
      where: { id: data.requesterTeamId },
      select: { slug: true, name: true },
    });
    const meta = {
      listing: listing.title,
      requester: requester.name,
      spotsRequested: data.spotsRequested,
      status: outcome.request.status,
    };
    await Promise.all([
      recordAudit({ teamId: data.requesterTeamId, actorId: userId, action: "request.submit", target: outcome.request.id, meta }),
      recordAudit({ teamId: listing.teamId, actorId: userId, action: "request.submit", target: outcome.request.id, meta }),
    ]);

    revalidateListing(listing.team.slug, listing);
    revalidatePath(`/dashboard/${requester.slug}/collab`, "layout");

    return ok(
      { requestId: outcome.request.id, status: outcome.request.status, teamSlug: requester.slug },
      "Request filed."
    );
  });
}

/** A platform admin files a request on behalf of a project with no oxbot account. */
export async function adminAddRequestAction(
  listingId: string,
  _prev: unknown,
  formData: FormData
): Promise<ActionState<{ requestId: string }>> {
  const userId = await requireUserId();

  return runAction<{ requestId: string }>(async () => {
    checkMutateLimit(userId);
    await requirePlatformAdmin(userId);

    const parsed = adminRequestFormSchema.safeParse({
      spotsRequested: formData.get("spotsRequested"),
      communityName: formData.get("communityName") ?? "",
      communitySize: formData.get("communitySize"),
      communityX: formData.get("communityX") ?? "",
      communityDiscord: formData.get("communityDiscord") ?? "",
      communityTelegram: formData.get("communityTelegram") ?? "",
      raffleProofImageUrl: formData.get("raffleProofImageUrl") || "",
      contactName: formData.get("contactName") ?? "",
      contactMethod: formData.get("contactMethod"),
      contactHandle: formData.get("contactHandle") ?? "",
    });
    if (!parsed.success) return fail("Please fix the errors below.", zodFieldErrors(parsed.error));
    const data = parsed.data;

    const listing = await db.whitelistListing.findUnique({
      where: { id: listingId },
      include: { team: { select: { id: true, slug: true, name: true } } },
    });
    if (!listing || listing.status === "DRAFT") return fail("Listing not found.");

    let outcome;
    try {
      outcome = await fileRequest(db, {
        listingId,
        requesterTeamId: null,
        submittedById: null,
        addedByAdminId: userId,
        spotsRequested: data.spotsRequested,
        communityName: data.communityName,
        communitySize: data.communitySize,
        communityX: data.communityX,
        communityDiscord: data.communityDiscord || null,
        communityTelegram: data.communityTelegram || null,
        raffleProofImageUrl: data.raffleProofImageUrl || null,
        contactName: data.contactName,
        contactMethod: data.contactMethod,
        contactHandle: data.contactHandle,
      });
    } catch (err) {
      if (err instanceof RequestRuleError || err instanceof InventoryError) return fail(err.message);
      throw err;
    }

    await recordAudit({
      teamId: listing.teamId,
      actorId: userId,
      action: "request.admin_add",
      target: outcome.request.id,
      meta: { listing: listing.title, community: data.communityName, spotsRequested: data.spotsRequested },
    });

    revalidateListing(listing.team.slug, listing);
    revalidatePath("/admin/collab");
    return ok({ requestId: outcome.request.id }, "Request added.");
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
    const requesterName = request.requesterTeam?.name ?? request.communityName;

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
            requester: requesterName,
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
        meta: { requester: requesterName, note },
      });
    }

    // A teamless (admin-added) request has no dashboard to notify — the admin
    // coordinates with the project directly via their given contact handle.
    if (request.requesterTeam) {
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
      revalidatePath(`/dashboard/${request.requesterTeam.slug}/collab`, "layout");
    }

    revalidateListing(listing.team.slug, listing);

    const messages = {
      approve: "Approved — spots reserved for the partner.",
      reject: "Request rejected.",
      needs_info: "Asked the requester for more info.",
      waitlist: "Request waitlisted.",
    } as const;
    return ok(undefined, messages[decision.decision]);
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
  if (!request || !request.requesterTeamId || !request.requesterTeam) {
    throw new AuthzError("Request not found.", "NOT_FOUND");
  }
  await requireTeamRole(userId, request.requesterTeamId, "COLLAB_MANAGER");
  return { ...request, requesterTeamId: request.requesterTeamId, requesterTeam: request.requesterTeam };
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
      data: { requesterReply: parsed.data.reply, status: "SUBMITTED" },
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
    // A teamless (admin-added) allocation has no receiving team to log in — the
    // listing team submits the wallets themselves, coordinated out-of-band.
    await requireTeamRole(userId, allocation.teamId ?? allocation.listing.teamId, "COLLAB_MANAGER");
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

    await recordAudit({
      teamId: allocation.listing.teamId,
      actorId: userId,
      action: "allocation.wallets",
      target: allocationId,
      meta: { partner: allocation.team?.name ?? null, wallets: wallets.length },
    });
    if (allocation.teamId) {
      await recordAudit({ teamId: allocation.teamId, actorId: userId, action: "allocation.wallets", target: allocationId, meta: { wallets: wallets.length } });
      revalidatePath(`/dashboard/${allocation.team?.slug}/collab`, "layout");
    }
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
    await recordAudit({
      teamId: allocation.listing.teamId,
      actorId: userId,
      action,
      target: allocationId,
      meta: { partner: allocation.team?.name ?? null, spots: allocation.spots },
    });
    if (allocation.teamId) {
      await recordAudit({ teamId: allocation.teamId, actorId: userId, action, target: allocationId, meta: { spots: allocation.spots } });
    }
    revalidateListing(allocation.listing.team.slug, allocation.listing);
    if (allocation.team) revalidatePath(`/dashboard/${allocation.team.slug}/collab`, "layout");
    const messages = { CONFIRMED: "Allocation confirmed.", DELIVERED: "Marked as delivered.", REVOKED: "Allocation revoked — spots returned to inventory." };
    return ok(undefined, messages[target]);
  });
}

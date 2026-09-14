import type { CollabRequest, ContactMethod, PrismaClient, RequestStatus, WhitelistListing } from "@prisma/client";

import { ACTIVE_REQUEST_STATUSES, OPEN_REQUEST_STATUSES } from "./constants";
import { InventoryError, grantSpots, lockListing } from "./inventory";

/**
 * Collab request filing + approval — the transactional core.
 *
 * Every request is a manual call by the listing team: filing never grants
 * spots by itself, and there is no scoring or drawing among requesters. The
 * only automation is the inventory lock, which makes concurrent approvals
 * race-safe.
 *
 * Kept free of Next.js / server-only imports (relative imports, a PrismaClient
 * passed in) so `scripts/collab-selftest.ts` can hammer it concurrently and
 * prove approvals never oversell.
 */

/** A business-rule rejection (own listing, duplicate, window closed…). */
export class RequestRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestRuleError";
  }
}

export type FileRequestInput = {
  listingId: string;
  /** Null only for a platform-admin-added request with no oxbot Team. */
  requesterTeamId: string | null;
  /** The signed-in requester, when they filed it themselves. */
  submittedById: string | null;
  /** The platform admin, when they filed it on the requester's behalf. */
  addedByAdminId: string | null;
  /**
   * Public self-filed requests must land on an OPEN listing only (matching the
   * desk UI). A platform admin may add a request to a paused/allocated listing,
   * so admin-add leaves this false.
   */
  requireOpenListing?: boolean;
  spotsRequested: number;
  communityName: string;
  communitySize: number;
  communityX: string;
  communityDiscord: string | null;
  communityTelegram: string | null;
  raffleProofImageUrl: string | null;
  contactName: string;
  contactMethod: ContactMethod;
  contactHandle: string;
};

export type FileRequestOutcome = {
  request: CollabRequest;
  listing: WhitelistListing;
};

/**
 * File a new request. Always lands as SUBMITTED — the listing team (or the
 * platform admin, for a teamless request) reviews and decides from there.
 */
export async function fileRequest(
  db: PrismaClient,
  input: FileRequestInput,
  now: Date = new Date()
): Promise<FileRequestOutcome> {
  return db.$transaction(
    async (tx) => {
      const listing = await lockListing(tx, input.listingId);

      if (input.requesterTeamId && listing.teamId === input.requesterTeamId) {
        throw new RequestRuleError("You can't request spots from your own listing.");
      }
      const t = now.getTime();
      if (listing.status === "DRAFT" || listing.status === "CANCELLED" || listing.status === "CLOSED") {
        throw new RequestRuleError("This listing isn't accepting requests.");
      }
      // Public requests are only allowed on an OPEN listing — a PAUSED listing
      // has stopped taking them and an ALLOCATED one is full. (Admin-add may
      // still place a request on those; it leaves requireOpenListing false.)
      if (input.requireOpenListing && listing.status !== "OPEN") {
        throw new RequestRuleError(
          listing.status === "PAUSED"
            ? "This listing has paused new requests."
            : "Every partner spot on this listing is taken."
        );
      }
      if (t < listing.startAt.getTime()) {
        throw new RequestRuleError("This listing isn't open for requests yet.");
      }
      if (t > listing.endAt.getTime()) {
        throw new RequestRuleError("This listing's request window has closed.");
      }
      if (input.spotsRequested < listing.spotsPerRequestMin || input.spotsRequested > listing.spotsPerRequestMax) {
        throw new RequestRuleError(
          `Request between ${listing.spotsPerRequestMin} and ${listing.spotsPerRequestMax} spots.`
        );
      }

      if (input.requesterTeamId) {
        const duplicate = await tx.collabRequest.findFirst({
          where: {
            listingId: listing.id,
            requesterTeamId: input.requesterTeamId,
            status: { in: ACTIVE_REQUEST_STATUSES },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new RequestRuleError("That project already has an active request on this listing.");
        }
      }

      const request = await tx.collabRequest.create({
        data: {
          listingId: listing.id,
          requesterTeamId: input.requesterTeamId,
          submittedById: input.submittedById,
          addedByAdminId: input.addedByAdminId,
          status: "SUBMITTED",
          spotsRequested: input.spotsRequested,
          communityName: input.communityName,
          communitySize: input.communitySize,
          communityX: input.communityX,
          communityDiscord: input.communityDiscord,
          communityTelegram: input.communityTelegram,
          raffleProofImageUrl: input.raffleProofImageUrl,
          contactName: input.contactName,
          contactMethod: input.contactMethod,
          contactHandle: input.contactHandle,
        },
      });

      return { request, listing };
    },
    { maxWait: 10_000, timeout: 15_000 }
  );
}

/**
 * Approve (fully or partially) an open request inside a listing lock. The
 * status guard is a compare-and-swap, so a request can never be approved twice
 * even if two reviewers click at once.
 */
export async function approveRequest(
  db: PrismaClient,
  input: { requestId: string; spotsGranted: number; reviewerId: string | null; note: string | null },
  now: Date = new Date()
): Promise<{ request: CollabRequest; listing: WhitelistListing; allocationId: string }> {
  return db.$transaction(
    async (tx) => {
      const pending = await tx.collabRequest.findUnique({ where: { id: input.requestId } });
      if (!pending) throw new RequestRuleError("Request not found.");
      const listing = await lockListing(tx, pending.listingId);

      if (listing.status === "CANCELLED") throw new RequestRuleError("This listing was cancelled.");
      const status: RequestStatus =
        input.spotsGranted < pending.spotsRequested ? "PARTIALLY_APPROVED" : "APPROVED";

      const claimed = await tx.collabRequest.updateMany({
        where: { id: pending.id, status: { in: OPEN_REQUEST_STATUSES } },
        data: {
          status,
          spotsGranted: input.spotsGranted,
          reviewerNote: input.note,
          reviewedById: input.reviewerId,
          reviewedAt: now,
        },
      });
      if (claimed.count === 0) throw new RequestRuleError("This request has already been decided.");

      const granted = await grantSpots(tx, listing, {
        teamId: pending.requesterTeamId,
        spots: input.spotsGranted,
        requestId: pending.id,
      });
      const request = await tx.collabRequest.findUniqueOrThrow({ where: { id: pending.id } });
      return { request, listing: granted.listing, allocationId: granted.allocation.id };
    },
    { maxWait: 10_000, timeout: 15_000 }
  );
}

export { InventoryError };

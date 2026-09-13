import type {
  AssetType,
  Blockchain,
  CollabRequest,
  Prisma,
  PrismaClient,
  RequestStatus,
  WhitelistListing,
} from "@prisma/client";

import { ACTIVE_REQUEST_STATUSES, OPEN_REQUEST_STATUSES, availableSpots, listingPhase } from "./constants";
import type { EligibilityResult } from "./eligibility";
import { InventoryError, grantSpots, lockListing } from "./inventory";
import { makeSeededRng, seededShuffle } from "../giveaway/winner-selection";

/**
 * Collab request distribution — the transactional core behind filing,
 * approving and raffling partner requests.
 *
 * Kept free of Next.js / server-only imports (relative imports, a PrismaClient
 * passed in) so `scripts/collab-selftest.ts` can hammer it concurrently and
 * prove the FCFS path never oversells.
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
  requesterTeamId: string;
  submittedById: string | null;
  spotsRequested: number;
  pitch: string;
  audienceSummary: string | null;
  communitySize: number | null;
  holderCount: number | null;
  twitterFollowers: number | null;
  discordMembers: number | null;
  /** Community name, links, reported raffle entries and contact details. */
  community: {
    communityName: string | null;
    communityX: string | null;
    communityDiscord: string | null;
    communityTelegram: string | null;
    communityTiktok: string | null;
    communityInstagram: string | null;
    reportedRaffleEntries: number | null;
    contactName: string | null;
    contactEmail: string | null;
    contactX: string | null;
    contactDiscord: string | null;
    contactTelegram: string | null;
  };
  requesterChains: Blockchain[];
  requesterAssetType: AssetType | null;
  evidence: { links: string[]; attestations: Record<string, boolean> };
  walletForDelivery: string | null;
  deliveryChain: Blockchain | null;
  eligibility: EligibilityResult;
};

export type FileRequestOutcome = {
  request: CollabRequest;
  listing: WhitelistListing;
  allocationId: string | null;
  /** True when an FCFS request was approved in the same transaction. */
  autoApproved: boolean;
};

/**
 * Initial status for a new request, decided inside the listing lock:
 *  FCFS     — qualified + fits remaining → APPROVED (spots granted now);
 *             qualified but no room → WAITLISTED; unqualified → SUBMITTED (flagged)
 *  CRITERIA — qualified → UNDER_REVIEW; unqualified → SUBMITTED (flagged)
 *  RAFFLE   — SUBMITTED; `eligible` decides who enters the draw at close
 *  MANUAL   — SUBMITTED
 */
function initialStatus(listing: WhitelistListing, input: FileRequestInput): RequestStatus {
  const eligible = input.eligibility.eligible;
  switch (listing.distributionMethod) {
    case "FCFS":
      if (!eligible) return "SUBMITTED";
      return input.spotsRequested <= availableSpots(listing) ? "APPROVED" : "WAITLISTED";
    case "CRITERIA":
      return eligible ? "UNDER_REVIEW" : "SUBMITTED";
    default:
      return "SUBMITTED";
  }
}

export async function fileRequest(
  db: PrismaClient,
  input: FileRequestInput,
  now: Date = new Date()
): Promise<FileRequestOutcome> {
  return db.$transaction(
    async (tx) => {
      const listing = await lockListing(tx, input.listingId);

      if (listing.teamId === input.requesterTeamId) {
        throw new RequestRuleError("You can't request spots from your own listing.");
      }
      // "allocated" is still accepted here: a request that lost the race for the
      // last FCFS spot is waitlisted rather than bounced.
      const phase = listingPhase(listing, now);
      if (phase !== "open" && phase !== "allocated") {
        throw new RequestRuleError(
          phase === "upcoming" ? "This listing isn't open for requests yet." : "This listing isn't accepting requests."
        );
      }
      if (input.spotsRequested < listing.spotsPerRequestMin || input.spotsRequested > listing.spotsPerRequestMax) {
        throw new RequestRuleError(
          `Request between ${listing.spotsPerRequestMin} and ${listing.spotsPerRequestMax} spots.`
        );
      }

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

      let status = initialStatus(listing, input);
      // No partner spots left: a qualified request waits for spots to free up.
      if (phase === "allocated" && status === "UNDER_REVIEW") status = "WAITLISTED";

      const request = await tx.collabRequest.create({
        data: {
          listingId: listing.id,
          requesterTeamId: input.requesterTeamId,
          submittedById: input.submittedById,
          status,
          spotsRequested: input.spotsRequested,
          spotsGranted: status === "APPROVED" ? input.spotsRequested : null,
          pitch: input.pitch,
          audienceSummary: input.audienceSummary,
          communitySize: input.communitySize,
          holderCount: input.holderCount,
          twitterFollowers: input.twitterFollowers,
          discordMembers: input.discordMembers,
          ...input.community,
          requesterChains: input.requesterChains,
          requesterAssetType: input.requesterAssetType,
          evidence: input.evidence as unknown as Prisma.InputJsonValue,
          walletForDelivery: input.walletForDelivery,
          deliveryChain: input.deliveryChain,
          eligible: input.eligibility.eligible,
          eligibilityScore: input.eligibility.score,
          eligibility: input.eligibility.checks as unknown as Prisma.InputJsonValue,
          reviewedAt: status === "APPROVED" ? now : null,
          reviewerNote: status === "APPROVED" ? "Auto-approved: first come, first served." : null,
        },
      });

      if (status !== "APPROVED") {
        return { request, listing, allocationId: null, autoApproved: false };
      }

      const granted = await grantSpots(tx, listing, {
        teamId: input.requesterTeamId,
        spots: input.spotsRequested,
        requestId: request.id,
      });
      return { request, listing: granted.listing, allocationId: granted.allocation.id, autoApproved: true };
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

// --- Partner raffle -----------------------------------------------------------

export type RaffleCandidate = { id: string; requesterTeamId: string; spotsRequested: number };

export type RafflePlanRow = { requestId: string; teamId: string; spots: number; rank: number };

/**
 * PURE: order qualified requests with a seeded CSPRNG shuffle (same HMAC-SHA256
 * construction as giveaway draws, sorted by id first so DB order never matters)
 * and walk the order granting spots. A winner gets what they asked for, or the
 * remainder if it still meets the listing's per-partner minimum; otherwise they
 * are passed over. Reproducible from `seed`.
 */
export function planPartnerRaffle(
  candidates: readonly RaffleCandidate[],
  capacity: number,
  minPerPartner: number,
  seed: string
): { winners: RafflePlanRow[]; passedOver: string[] } {
  const base = candidates.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const order = seededShuffle(base, makeSeededRng(seed));
  let remaining = Math.max(0, capacity);
  const winners: RafflePlanRow[] = [];
  const passedOver: string[] = [];
  for (const c of order) {
    const spots = Math.min(c.spotsRequested, remaining);
    if (spots >= Math.max(1, minPerPartner)) {
      winners.push({ requestId: c.id, teamId: c.requesterTeamId, spots, rank: winners.length + 1 });
      remaining -= spots;
    } else {
      passedOver.push(c.id);
    }
  }
  return { winners, passedOver };
}

/**
 * Run the RAFFLE-method draw: qualified open requests are shuffled with `seed`,
 * winners are granted spots, the rest are waitlisted, unqualified requests
 * expire, and the listing closes with the seed stored for audit.
 */
export async function drawPartnerRaffle(
  db: PrismaClient,
  input: { listingId: string; seed: string; reviewerId: string | null },
  now: Date = new Date()
): Promise<{ listing: WhitelistListing; winners: RafflePlanRow[]; waitlisted: number; expired: number }> {
  return db.$transaction(
    async (tx) => {
      const listing = await lockListing(tx, input.listingId);
      if (listing.distributionMethod !== "RAFFLE") throw new RequestRuleError("This listing doesn't use a partner raffle.");
      if (listing.drawnAt) throw new RequestRuleError("The partner raffle has already been drawn.");
      if (listing.status === "DRAFT" || listing.status === "CANCELLED") {
        throw new RequestRuleError("Publish the listing before drawing.");
      }

      const open = await tx.collabRequest.findMany({
        where: { listingId: listing.id, status: { in: OPEN_REQUEST_STATUSES } },
        select: { id: true, requesterTeamId: true, spotsRequested: true, eligible: true },
      });
      const qualified = open.filter((r) => r.eligible);
      const plan = planPartnerRaffle(qualified, availableSpots(listing), listing.spotsPerRequestMin, input.seed);

      let current = listing;
      for (const w of plan.winners) {
        const requested = qualified.find((q) => q.id === w.requestId)!.spotsRequested;
        await tx.collabRequest.update({
          where: { id: w.requestId },
          data: {
            status: w.spots < requested ? "PARTIALLY_APPROVED" : "APPROVED",
            spotsGranted: w.spots,
            reviewedById: input.reviewerId,
            reviewedAt: now,
            reviewerNote: `Won the partner raffle (draw #${w.rank}).`,
          },
        });
        current = (await grantSpots(tx, current, { teamId: w.teamId, spots: w.spots, requestId: w.requestId })).listing;
      }

      const waitlisted = await tx.collabRequest.updateMany({
        where: { id: { in: plan.passedOver } },
        data: { status: "WAITLISTED", reviewedAt: now, reviewerNote: "Not drawn in the partner raffle." },
      });
      const expired = await tx.collabRequest.updateMany({
        where: { listingId: listing.id, status: { in: OPEN_REQUEST_STATUSES }, eligible: false },
        data: { status: "EXPIRED", reviewerNote: "Didn't meet the listing criteria for the raffle." },
      });

      const closed = await tx.whitelistListing.update({
        where: { id: listing.id },
        data: { status: "CLOSED", drawSeed: input.seed, drawnAt: now },
      });
      return { listing: closed, winners: plan.winners, waitlisted: waitlisted.count, expired: expired.count };
    },
    { maxWait: 10_000, timeout: 30_000 }
  );
}

export { InventoryError };

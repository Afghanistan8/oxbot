import type { AllocationStatus, CollabAllocation, Prisma, WhitelistListing } from "@prisma/client";

import { availableSpots } from "./constants";

/**
 * Collab inventory — the ONLY place listing spot counters change.
 *
 * Invariant: totalSpots >= reservedSpots + allocatedSpots.
 *
 * Every helper takes a transaction client and expects the caller to have
 * locked the listing row first via {@link lockListing} (`SELECT … FOR UPDATE`).
 * Postgres then serializes concurrent grants on the same listing: the second
 * transaction blocks on the lock, re-reads the counters the first one wrote,
 * and sees the true remaining inventory — so spots can never be oversold, even
 * when two FCFS requests land in the same millisecond.
 *
 * Relative imports only: `scripts/collab-selftest.ts` runs this under tsx.
 */

type Tx = Prisma.TransactionClient;

/** Thrown when an inventory operation would break the invariant. */
export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

/** Row-lock a listing for the rest of the transaction and return its fresh state. */
export async function lockListing(tx: Tx, listingId: string): Promise<WhitelistListing> {
  await tx.$queryRaw`SELECT "id" FROM "WhitelistListing" WHERE "id" = ${listingId} FOR UPDATE`;
  const listing = await tx.whitelistListing.findUnique({ where: { id: listingId } });
  if (!listing) throw new InventoryError("Listing not found.");
  return listing;
}

/**
 * After counters change: flip OPEN ↔ ALLOCATED to match remaining inventory.
 * Other statuses (DRAFT/PAUSED/CLOSED/CANCELLED) are left alone.
 */
async function syncAllocatedStatus(tx: Tx, listing: WhitelistListing): Promise<WhitelistListing> {
  const remaining = availableSpots(listing);
  if (listing.status === "OPEN" && remaining === 0) {
    return tx.whitelistListing.update({ where: { id: listing.id }, data: { status: "ALLOCATED" } });
  }
  if (listing.status === "ALLOCATED" && remaining > 0) {
    return tx.whitelistListing.update({ where: { id: listing.id }, data: { status: "OPEN" } });
  }
  return listing;
}

/**
 * Grant `spots` from a locked listing to a receiving team. Creates a RESERVED
 * allocation (spots held until the partner's wallets are confirmed) and bumps
 * `reservedSpots`. Throws {@link InventoryError} if the spots aren't there.
 */
export async function grantSpots(
  tx: Tx,
  listing: WhitelistListing,
  input: { teamId: string | null; spots: number; requestId?: string | null; note?: string | null }
): Promise<{ allocation: CollabAllocation; listing: WhitelistListing }> {
  const remaining = availableSpots(listing);
  if (!Number.isInteger(input.spots) || input.spots < 1) {
    throw new InventoryError("Grant at least 1 spot.");
  }
  if (input.spots > remaining) {
    throw new InventoryError(
      remaining === 0
        ? "No partner spots are left on this listing."
        : `Only ${remaining} partner spot${remaining === 1 ? " is" : "s are"} left.`
    );
  }

  const updated = await tx.whitelistListing.update({
    where: { id: listing.id },
    data: { reservedSpots: { increment: input.spots } },
  });
  const allocation = await tx.collabAllocation.create({
    data: {
      listingId: listing.id,
      teamId: input.teamId,
      requestId: input.requestId ?? null,
      spots: input.spots,
      status: "RESERVED",
      note: input.note ?? null,
    },
  });
  return { allocation, listing: await syncAllocatedStatus(tx, updated) };
}

/** Which counter an allocation in `status` is currently held in. */
function bucketFor(status: AllocationStatus): "reservedSpots" | "allocatedSpots" | null {
  if (status === "RESERVED") return "reservedSpots";
  if (status === "CONFIRMED" || status === "DELIVERED") return "allocatedSpots";
  return null; // REVOKED holds nothing
}

/**
 * Move an allocation to a new status, shifting its spots between counters:
 *  RESERVED → CONFIRMED/DELIVERED  : reserved −n, allocated +n
 *  any live → REVOKED              : its counter −n (spots return to inventory)
 *  CONFIRMED ↔ DELIVERED           : no counter change
 * REVOKED is terminal.
 */
export async function transitionAllocation(
  tx: Tx,
  listing: WhitelistListing,
  allocation: CollabAllocation,
  to: AllocationStatus,
  extra: Prisma.CollabAllocationUpdateInput = {}
): Promise<{ allocation: CollabAllocation; listing: WhitelistListing }> {
  if (allocation.listingId !== listing.id) throw new InventoryError("Allocation / listing mismatch.");
  if (allocation.status === "REVOKED") throw new InventoryError("This allocation was already revoked.");
  if (allocation.status === to) throw new InventoryError("Nothing to change.");

  const from = bucketFor(allocation.status);
  const into = bucketFor(to);
  const data: Prisma.WhitelistListingUpdateInput = {};
  if (from !== into) {
    if (from) data[from] = { decrement: allocation.spots };
    if (into) data[into] = { increment: allocation.spots };
  }

  const now = new Date();
  const updatedAllocation = await tx.collabAllocation.update({
    where: { id: allocation.id },
    data: {
      status: to,
      ...(to === "CONFIRMED" ? { confirmedAt: now } : {}),
      ...(to === "DELIVERED" ? { deliveredAt: now, confirmedAt: allocation.confirmedAt ?? now } : {}),
      ...(to === "REVOKED" ? { revokedAt: now } : {}),
      ...extra,
    },
  });

  let updatedListing = listing;
  if (Object.keys(data).length) {
    updatedListing = await tx.whitelistListing.update({ where: { id: listing.id }, data });
    if (
      updatedListing.reservedSpots < 0 ||
      updatedListing.allocatedSpots < 0 ||
      availableSpots(updatedListing) < 0
    ) {
      throw new InventoryError("Inventory counters would go negative.");
    }
  }
  return { allocation: updatedAllocation, listing: await syncAllocatedStatus(tx, updatedListing) };
}

/**
 * Validate a new total against what's already granted. Used by listing edits
 * so a founder can't shrink inventory below committed spots.
 */
export function assertCapacity(
  listing: Pick<WhitelistListing, "reservedSpots" | "allocatedSpots">,
  next: { totalSpots: number }
): void {
  const committed = listing.reservedSpots + listing.allocatedSpots;
  if (next.totalSpots < committed) {
    throw new InventoryError(
      `${committed} spot${committed === 1 ? " is" : "s are"} already granted — total spots can't go below that.`
    );
  }
}

/** Re-sync OPEN/ALLOCATED after an edit changed totals (listing must be locked). */
export async function resyncListingStatus(tx: Tx, listingId: string): Promise<WhitelistListing> {
  const listing = await tx.whitelistListing.findUniqueOrThrow({ where: { id: listingId } });
  return syncAllocatedStatus(tx, listing);
}

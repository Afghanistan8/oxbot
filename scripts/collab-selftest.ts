/**
 * OxFoxes Collab self-test.
 *
 *   npm run collab:selftest            # pure checks + DB race tests
 *   npm run collab:selftest -- --no-db # pure checks only
 *
 * 1. Inventory math: `availableSpots` never goes negative.
 * 2. Concurrent approvals (DB): many requests are approved at the same instant
 *    against a small listing — asserts spots are never oversold and counters
 *    match the allocation rows. Also double-approves one request concurrently
 *    and a duplicate double-file from one team.
 *
 * There's no scoring or auto-approval here anymore — every request lands as
 * SUBMITTED and a human decides. The thing worth proving race-safe is the
 * grant itself.
 *
 * DB tests create rows prefixed `zz-collab-selftest-` and always delete them.
 * Relative imports only (runs under tsx).
 */
import { PrismaClient } from "@prisma/client";

import { availableSpots } from "../src/lib/collab/constants";
import { RequestRuleError, approveRequest, fileRequest, type FileRequestInput } from "../src/lib/collab/requests";
import { InventoryError } from "../src/lib/collab/inventory";

const PREFIX = "zz-collab-selftest-";
let failures = 0;

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${name}`, detail ?? "");
  }
}

function pureTests() {
  console.log("\nInventory math");
  check("fully available", availableSpots({ totalSpots: 10, reservedSpots: 0, allocatedSpots: 0 }) === 10);
  check("partially granted", availableSpots({ totalSpots: 10, reservedSpots: 3, allocatedSpots: 2 }) === 5);
  check("never negative when oversubscribed", availableSpots({ totalSpots: 10, reservedSpots: 6, allocatedSpots: 6 }) === 0);
}

async function dbTests(db: PrismaClient) {
  console.log("\nConcurrent approvals (database)");
  const stamp = Date.now().toString(36);
  const lister = await db.team.create({ data: { slug: `${PREFIX}lister-${stamp}`, name: "Selftest Lister" } });
  const requesters = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      db.team.create({ data: { slug: `${PREFIX}req-${i}-${stamp}`, name: `Selftest Requester ${i}` } })
    )
  );

  try {
    const listing = await db.whitelistListing.create({
      data: {
        teamId: lister.id,
        slug: `${PREFIX}listing-${stamp}`,
        title: "Selftest listing",
        assetType: "NFT",
        chain: "ETHEREUM",
        totalSpots: 10,
        spotsPerRequestMin: 1,
        spotsPerRequestMax: 3,
        status: "OPEN",
        startAt: new Date(Date.now() - 60_000),
        endAt: new Date(Date.now() + 3_600_000),
      },
    });

    const input = (teamId: string): FileRequestInput => ({
      listingId: listing.id,
      requesterTeamId: teamId,
      submittedById: null,
      addedByAdminId: null,
      spotsRequested: 3,
      communityName: "Selftest Community",
      communitySize: 1,
      communityX: "https://x.com/selftest",
      communityDiscord: null,
      communityTelegram: null,
      raffleProofImageUrl: null,
      contactName: "Selftest",
      contactMethod: "X",
      contactHandle: "selftest",
    });

    // 12 teams file at once — filing never touches inventory, so all should land as SUBMITTED.
    const filed = await Promise.allSettled(requesters.map((t) => fileRequest(db, input(t.id))));
    const fulfiled = filed.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const filedRejected = filed.filter((r) => r.status === "rejected");
    check("every concurrent filing resolved", filedRejected.length === 0, filedRejected);
    check("every request lands as SUBMITTED", fulfiled.every((o) => o.request.status === "SUBMITTED"));

    // 12 requests × 3 spots = 36 asked against 10 total spots, approved all at once.
    const approvals = await Promise.allSettled(
      fulfiled.map((o) => approveRequest(db, { requestId: o.request.id, spotsGranted: 3, reviewerId: null, note: null }))
    );
    const approved = approvals.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const capacityErrors = approvals.filter((r) => r.status === "rejected" && r.reason instanceof InventoryError);

    const after = await db.whitelistListing.findUniqueOrThrow({ where: { id: listing.id } });
    const allocations = await db.collabAllocation.findMany({ where: { listingId: listing.id } });
    const allocated = allocations.reduce((n, a) => n + a.spots, 0);

    check("exactly 3 requests approved (9 of 10 spots, the 4th would overshoot)", approved.length === 3, approved.length);
    check("the rest hit the inventory cap", capacityErrors.length === fulfiled.length - approved.length, capacityErrors.length);
    check("reserved counter equals allocation rows", after.reservedSpots === allocated, { reserved: after.reservedSpots, allocated });
    check("never oversold: reserved + allocated <= total", after.reservedSpots + after.allocatedSpots <= after.totalSpots, after);

    console.log("\nDuplicate + double-approve (database)");
    const pending = fulfiled.find((o) => !approved.some((a) => a.request.id === o.request.id))!.request;
    // Free inventory by growing the listing, then race two approvals of the same still-open request.
    await db.whitelistListing.update({ where: { id: listing.id }, data: { totalSpots: 13, status: "OPEN" } });
    const doubleApprove = await Promise.allSettled([
      approveRequest(db, { requestId: pending.id, spotsGranted: 3, reviewerId: null, note: null }),
      approveRequest(db, { requestId: pending.id, spotsGranted: 3, reviewerId: null, note: null }),
    ]);
    const okApprovals = doubleApprove.filter((r) => r.status === "fulfilled").length;
    const ruleErrors = doubleApprove.filter((r) => r.status === "rejected" && r.reason instanceof RequestRuleError).length;
    check("one of two concurrent approvals wins", okApprovals === 1 && ruleErrors === 1, doubleApprove);

    const dupTeam = requesters[0]!;
    const dups = await Promise.allSettled([fileRequest(db, input(dupTeam.id)), fileRequest(db, input(dupTeam.id))]);
    check(
      "a team with an active request can't file another",
      dups.every((r) => r.status === "rejected" && r.reason instanceof RequestRuleError),
      dups
    );
  } finally {
    await db.whitelistListing.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await db.team.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    console.log("\n  (selftest rows cleaned up)");
  }
}

async function main() {
  pureTests();
  if (!process.argv.includes("--no-db")) {
    if (!process.env.DATABASE_URL) process.loadEnvFile?.(".env");
    // A small dedicated pool: enough for genuinely concurrent transactions to
    // contend for the listing lock, without exhausting a hosted pooler.
    const url = new URL(process.env.DATABASE_URL ?? "");
    url.searchParams.set("connection_limit", "5");
    url.searchParams.set("pool_timeout", "60");
    const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    try {
      await dbTests(db);
    } finally {
      await db.$disconnect();
    }
  }
  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll Collab checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

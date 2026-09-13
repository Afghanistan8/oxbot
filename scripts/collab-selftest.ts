/**
 * OxFoxes Collab self-test.
 *
 *   npm run collab:selftest            # pure checks + DB race tests
 *   npm run collab:selftest -- --no-db # pure checks only
 *
 * 1. Eligibility engine: thresholds, chains, attestations, scoring.
 * 2. Partner raffle plan: deterministic for a seed, never exceeds capacity.
 * 3. FCFS race (DB): many teams file at the same instant against a small
 *    listing — asserts spots are never oversold and counters match the
 *    allocation rows. Also double-approves one request concurrently and a
 *    duplicate double-submit from one team.
 *
 * DB tests create rows prefixed `zz-collab-selftest-` and always delete them.
 * Relative imports only (runs under tsx).
 */
import { PrismaClient } from "@prisma/client";

import { evaluateEligibility, type CriteriaInput } from "../src/lib/collab/eligibility";
import { availableSpots } from "../src/lib/collab/constants";
import {
  RequestRuleError,
  approveRequest,
  fileRequest,
  planPartnerRaffle,
  type FileRequestInput,
} from "../src/lib/collab/requests";

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
  console.log("\nEligibility engine");
  const criteria: CriteriaInput = {
    minCommunitySize: 5000,
    minHolderCount: null,
    minTwitterFollowers: 3000,
    minDiscordMembers: null,
    minRaffleEntries: 10,
    requiredChains: ["ETHEREUM"],
    requiredAssetType: null,
    requireVerifiedTeam: false,
    customRules: [{ id: "doxxed", label: "Doxxed team" }],
  };
  const base = {
    communitySize: 9000,
    holderCount: null,
    twitterFollowers: 4000,
    discordMembers: null,
    raffleEntries: 12,
    chains: ["ETHEREUM" as const],
    assetType: null,
    verifiedTeam: false,
    attestations: { doxxed: true },
  };
  const pass = evaluateEligibility(criteria, { ...base, chains: [...base.chains] });
  check("qualified requester is eligible with score 100", pass.eligible && pass.score === 100, pass);

  const low = evaluateEligibility(criteria, { ...base, chains: ["SOLANA"], communitySize: 100, attestations: {} });
  check("under-qualified requester is flagged", !low.eligible && low.score < 100, low);
  check(
    "missing checks are the failing ones",
    low.checks.filter((c) => !c.met).map((c) => c.key).sort().join() === ["chains", "communitySize", "rule:doxxed"].sort().join(),
    low.checks
  );
  check("no criteria → eligible", evaluateEligibility(null, { ...base, chains: [] }).eligible);

  console.log("\nPartner raffle plan");
  const candidates = Array.from({ length: 20 }, (_, i) => ({
    id: `req-${String(i).padStart(2, "0")}`,
    requesterTeamId: `team-${i}`,
    spotsRequested: 3 + (i % 4),
  }));
  const a = planPartnerRaffle(candidates, 25, 2, "seed-one");
  const b = planPartnerRaffle([...candidates].reverse(), 25, 2, "seed-one");
  const c = planPartnerRaffle(candidates, 25, 2, "seed-two");
  check("same seed → same winners regardless of input order", JSON.stringify(a) === JSON.stringify(b));
  check("different seed → different order", JSON.stringify(a.winners) !== JSON.stringify(c.winners));
  const granted = a.winners.reduce((n, w) => n + w.spots, 0);
  check("never grants more than capacity", granted <= 25, granted);
  check("respects the per-partner minimum", a.winners.every((w) => w.spots >= 2));
}

async function dbTests(db: PrismaClient) {
  console.log("\nFCFS race (database)");
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
        title: "Selftest FCFS",
        assetType: "NFT",
        chain: "ETHEREUM",
        totalSpots: 10,
        publicSpots: 1,
        spotsPerRequestMin: 1,
        spotsPerRequestMax: 3,
        distributionMethod: "FCFS",
        status: "OPEN",
        startAt: new Date(Date.now() - 60_000),
        endAt: new Date(Date.now() + 3_600_000),
      },
    });

    const eligibility = { eligible: true, score: 100, checks: [] };
    const input = (teamId: string): FileRequestInput => ({
      listingId: listing.id,
      requesterTeamId: teamId,
      submittedById: null,
      spotsRequested: 3,
      pitch: "Selftest request",
      audienceSummary: null,
      communitySize: 1,
      holderCount: null,
      twitterFollowers: null,
      discordMembers: null,
      community: {
        communityName: "Selftest Community",
        communityX: "https://x.com/selftest",
        communityDiscord: null,
        communityTelegram: null,
        communityTiktok: null,
        communityInstagram: null,
        reportedRaffleEntries: 0,
        contactName: "Selftest",
        contactEmail: "selftest@oxbot.test",
        contactX: null,
        contactDiscord: null,
        contactTelegram: null,
      },
      requesterChains: [],
      requesterAssetType: null,
      evidence: { links: [], attestations: {} },
      walletForDelivery: null,
      deliveryChain: null,
      eligibility,
    });

    // 12 teams × 3 spots = 36 asked against 9 partner spots, all at once.
    const results = await Promise.allSettled(requesters.map((t) => fileRequest(db, input(t.id))));
    const fulfilled = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const rejected = results.filter((r) => r.status === "rejected");
    check("every concurrent submission resolved", rejected.length === 0, rejected);

    const approved = fulfilled.filter((o) => o.request.status === "APPROVED");
    const waitlisted = fulfilled.filter((o) => o.request.status === "WAITLISTED");
    const after = await db.whitelistListing.findUniqueOrThrow({ where: { id: listing.id } });
    const allocations = await db.collabAllocation.findMany({ where: { listingId: listing.id } });
    const allocated = allocations.reduce((n, a) => n + a.spots, 0);

    check("exactly 3 requests approved (9 partner spots / 3 each)", approved.length === 3, approved.length);
    check("the other 9 were waitlisted", waitlisted.length === 9, waitlisted.length);
    check("reserved counter equals allocation rows", after.reservedSpots === allocated, { reserved: after.reservedSpots, allocated });
    check(
      "never oversold: reserved + allocated + public <= total",
      after.reservedSpots + after.allocatedSpots + after.publicSpots <= after.totalSpots,
      after
    );
    check("available is 0 and listing flipped to ALLOCATED", availableSpots(after) === 0 && after.status === "ALLOCATED", after);

    console.log("\nDuplicate + double-approve (database)");
    // Free inventory by growing the listing, then race two approvals of one waitlisted request.
    await db.whitelistListing.update({ where: { id: listing.id }, data: { totalSpots: 13, status: "OPEN" } });
    const target = waitlisted[0]!.request;
    const approvals = await Promise.allSettled([
      approveRequest(db, { requestId: target.id, spotsGranted: 3, reviewerId: null, note: null }),
      approveRequest(db, { requestId: target.id, spotsGranted: 3, reviewerId: null, note: null }),
    ]);
    const okApprovals = approvals.filter((r) => r.status === "fulfilled").length;
    const ruleErrors = approvals.filter((r) => r.status === "rejected" && r.reason instanceof RequestRuleError).length;
    check("one of two concurrent approvals wins", okApprovals === 1 && ruleErrors === 1, approvals);
    const afterApprove = await db.whitelistListing.findUniqueOrThrow({ where: { id: listing.id } });
    check("approval moved exactly 3 more spots", afterApprove.reservedSpots === 12, afterApprove.reservedSpots);

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

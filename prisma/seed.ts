/**
 * oxbot seed — demo data for local development.
 *
 * Creates:
 *  - a demo user (founder) + a second demo entrant
 *  - a demo Team/Project ("Ember Labs")
 *  - one giveaway of each type (RANDOM, FCFS, CODE) with realistic requirements
 *  - entry codes for the CODE giveaway
 *  - a couple of sample entries + one finalized winner on a past giveaway
 *
 * Run with:  npm run db:seed
 *
 * Uses relative imports (not the `@/` alias) because it runs under tsx.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { generateUniqueCodes } from "../src/lib/giveaway/codes";
import { evaluateEligibility, type CriteriaInput } from "../src/lib/collab/eligibility";

const db = new PrismaClient();

/** Helper: now + N days (UTC). */
function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log("🌱 Seeding oxbot demo data…");

  // --- Users ---------------------------------------------------------------
  const founder = await db.user.upsert({
    where: { email: "founder@oxbot.app" },
    update: {},
    create: {
      email: "founder@oxbot.app",
      name: "Ember Founder",
      emailVerified: new Date(),
      image: "https://api.dicebear.com/9.x/thumbs/svg?seed=ember-founder",
    },
  });

  const entrant = await db.user.upsert({
    where: { email: "entrant@oxbot.app" },
    update: {},
    create: {
      email: "entrant@oxbot.app",
      name: "Demo Entrant",
      emailVerified: new Date(),
      image: "https://api.dicebear.com/9.x/thumbs/svg?seed=demo-entrant",
    },
  });

  // --- Team / Project ------------------------------------------------------
  const team = await db.team.upsert({
    where: { slug: "ember-labs" },
    update: {},
    create: {
      slug: "ember-labs",
      name: "Ember Labs",
      description:
        "A fictional Web3 studio crafting fiery on-chain experiences. Used for oxbot demo data.",
      website: "https://example.com",
      xHandle: "emberlabs",
      discordInvite: "https://discord.gg/example",
      logoUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=ember-labs",
      bannerUrl:
        "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=1600&q=80",
      chains: ["ETHEREUM", "BASE", "SOLANA"],
      members: {
        create: {
          userId: founder.id,
          role: "OWNER",
        },
      },
    },
  });

  console.log(`  ✓ Team: ${team.name} (owner: ${founder.email})`);

  // --- 1) RANDOM raffle (active) ------------------------------------------
  const randomGiveaway = await db.giveaway.upsert({
    where: { slug: "ember-genesis-raffle" },
    update: {},
    create: {
      teamId: team.id,
      slug: "ember-genesis-raffle",
      title: "Ember Genesis WL Raffle",
      description:
        "Win one of 10 guaranteed whitelist spots for the Ember Genesis mint. Complete the tasks below to enter — winners drawn at random when the raffle ends.",
      prize: "10× Guaranteed Whitelist Spots (Ember Genesis)",
      type: "RANDOM",
      status: "ACTIVE",
      visibility: "PUBLIC",
      chain: "ETHEREUM",
      winnersCount: 10,
      startAt: daysFromNow(-2),
      endAt: daysFromNow(5),
      xAccount: "emberlabs",
      hideEntryCount: false,
      bannerUrl:
        "https://images.unsplash.com/photo-1620121692029-d088224ddc74?w=1600&q=80",
      createdById: founder.id,
      requirements: {
        create: [
          { type: "CAPTCHA", order: 0, config: {} },
          { type: "TWITTER_FOLLOW", order: 1, config: { handle: "emberlabs" } },
          {
            type: "DISCORD_MEMBER",
            order: 2,
            config: { guildId: "000000000000000000" },
          },
        ],
      },
    },
  });
  console.log(`  ✓ Giveaway (RANDOM): ${randomGiveaway.title}`);

  // --- 2) FCFS giveaway (active) ------------------------------------------
  const fcfsGiveaway = await db.giveaway.upsert({
    where: { slug: "base-speedrun-fcfs" },
    update: {},
    create: {
      teamId: team.id,
      slug: "base-speedrun-fcfs",
      title: "Base Speedrun — First 50 Win",
      description:
        "The first 50 people to complete every task claim a spot. No luck involved — pure speed. Good luck!",
      prize: "50× Base Speedrun Allowlist",
      type: "FCFS",
      status: "ACTIVE",
      visibility: "PUBLIC",
      chain: "BASE",
      winnersCount: 50,
      startAt: daysFromNow(-1),
      endAt: daysFromNow(3),
      xAccount: "emberlabs",
      hideEntryCount: true, // demonstrate hidden count
      bannerUrl:
        "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1600&q=80",
      createdById: founder.id,
      requirements: {
        create: [
          { type: "CAPTCHA", order: 0, config: {} },
          { type: "EMAIL", order: 1, config: {} },
          { type: "TWITTER_FOLLOW", order: 2, config: { handle: "emberlabs" } },
        ],
      },
    },
  });
  console.log(`  ✓ Giveaway (FCFS): ${fcfsGiveaway.title}`);

  // --- 3) CODE giveaway (private) -----------------------------------------
  const codeGiveaway = await db.giveaway.upsert({
    where: { slug: "ember-insiders-code" },
    update: {},
    create: {
      teamId: team.id,
      slug: "ember-insiders-code",
      title: "Ember Insiders — Invite Only",
      description:
        "A private drop for Ember insiders. Enter your invite code to participate.",
      prize: "5× Insider Founder Passes",
      type: "CODE",
      status: "ACTIVE",
      visibility: "PRIVATE",
      chain: "SOLANA",
      winnersCount: 5,
      startAt: daysFromNow(-1),
      endAt: daysFromNow(7),
      hideEntryCount: true,
      createdById: founder.id,
      requirements: {
        create: [
          { type: "CODE", order: 0, config: { caseSensitive: false } },
          { type: "CAPTCHA", order: 1, config: {} },
        ],
      },
    },
  });
  console.log(`  ✓ Giveaway (CODE): ${codeGiveaway.title}`);

  // Generate 25 single-use codes for the CODE giveaway.
  const codes = generateUniqueCodes(25, { length: 8, prefix: "EMBER" });
  await db.entryCode.createMany({
    data: codes.map((code) => ({
      giveawayId: codeGiveaway.id,
      code,
      maxUses: 1,
    })),
    skipDuplicates: true,
  });
  console.log(`    → generated ${codes.length} entry codes (e.g. ${codes[0]})`);

  // --- 4) A finalized past giveaway with a winner --------------------------
  const pastGiveaway = await db.giveaway.upsert({
    where: { slug: "ember-launch-week" },
    update: {},
    create: {
      teamId: team.id,
      slug: "ember-launch-week",
      title: "Ember Launch Week Giveaway",
      description: "Our launch-week celebration raffle. Now finalized.",
      prize: "1× 0.5 ETH + Founder Pass",
      type: "RANDOM",
      status: "FINALIZED",
      visibility: "PUBLIC",
      chain: "ETHEREUM",
      winnersCount: 1,
      startAt: daysFromNow(-14),
      endAt: daysFromNow(-7),
      drawnAt: daysFromNow(-7),
      drawSeed: "demo-seed-abc123",
      xAccount: "emberlabs",
      createdById: founder.id,
      requirements: {
        create: [{ type: "CAPTCHA", order: 0, config: {} }],
      },
    },
  });

  // A completed entry from the demo entrant on the past giveaway, marked winner.
  const pastEntry = await db.entry.upsert({
    where: {
      giveawayId_userId: { giveawayId: pastGiveaway.id, userId: entrant.id },
    },
    update: {},
    create: {
      giveawayId: pastGiveaway.id,
      userId: entrant.id,
      status: "COMPLETED",
      seq: 1,
      submittedAt: daysFromNow(-8),
      metadata: { source: "seed" },
    },
  });

  await db.winner.upsert({
    where: { entryId: pastEntry.id },
    update: {},
    create: {
      giveawayId: pastGiveaway.id,
      entryId: pastEntry.id,
      userId: entrant.id,
      rank: 1,
      method: "RANDOM",
      selectedAt: daysFromNow(-7),
    },
  });
  console.log(
    `  ✓ Giveaway (FINALIZED): ${pastGiveaway.title} — winner: ${entrant.email}`
  );

  // --- A sample in-progress entry on the active RANDOM giveaway ------------
  await db.entry.upsert({
    where: {
      giveawayId_userId: { giveawayId: randomGiveaway.id, userId: entrant.id },
    },
    update: {},
    create: {
      giveawayId: randomGiveaway.id,
      userId: entrant.id,
      status: "PENDING",
      metadata: { source: "seed" },
    },
  });

  await seedCollab(founder.id);

  console.log("\n✅ Seed complete.\n");
  console.log("   Founder login:  founder@oxbot.app");
  console.log("   Entrant login:  entrant@oxbot.app");
  console.log("   (In dev, magic-link URLs print to this console on sign-in.)\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

// ---------------------------------------------------------------------------
// OxFoxes Collab demo data
//
//  - "Lava Foxes" lists 200 GTD spots (CRITERIA) with a 40-spot public raffle
//  - "Arch DAO" requests 25 spots (meets criteria → under review)
//  - "Small Labs" requests 40 spots (below criteria → flagged)
//  - "Lava Foxes Public WL" raffle: X follow + NFT hold, linked to the listing
//  - an FCFS listing with 10 spots, 7 already reserved for Arch DAO
//
// Slugs carry a -demo suffix so they can never collide with a real project.
// ---------------------------------------------------------------------------

async function upsertDemoTeam(
  slug: string,
  name: string,
  ownerEmail: string,
  extra: Partial<Prisma.TeamCreateInput> = {}
) {
  const owner = await db.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: {
      email: ownerEmail,
      name: `${name} Owner`,
      emailVerified: new Date(),
      image: `https://api.dicebear.com/9.x/thumbs/svg?seed=${slug}`,
    },
  });
  const team = await db.team.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      name,
      logoUrl: `https://api.dicebear.com/9.x/shapes/svg?seed=${slug}`,
      members: { create: { userId: owner.id, role: "OWNER" } },
      ...extra,
    },
  });
  return { team, owner };
}

async function seedCollab(founderId: string) {
  const lava = await upsertDemoTeam("lava-foxes-demo", "Lava Foxes", "lava@oxbot.app", {
    description: "A molten 3,333-piece fox collection on Ethereum. Demo data for OxFoxes Collab.",
    xHandle: "lavafoxes",
    discordInvite: "https://discord.gg/example",
    bannerUrl: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=1600&q=80",
    chains: ["ETHEREUM"],
    primaryChain: "ETHEREUM",
    totalSupply: "3333",
    mintPrice: "0.05 ETH",
    mintAt: daysFromNow(21),
  });
  const arch = await upsertDemoTeam("arch-dao-demo", "Arch DAO", "arch@oxbot.app", {
    description: "A builder DAO for on-chain culture. Demo requester.",
    xHandle: "archdao",
    discordInvite: "https://discord.gg/example",
    chains: ["ETHEREUM", "BASE"],
    primaryChain: "ETHEREUM",
  });
  const small = await upsertDemoTeam("small-labs-demo", "Small Labs", "small@oxbot.app", {
    description: "An early-stage studio. Demo requester below criteria.",
    chains: ["SOLANA"],
    primaryChain: "SOLANA",
  });

  const criteria: CriteriaInput = {
    minCommunitySize: 5000,
    minHolderCount: null,
    minTwitterFollowers: 3000,
    minDiscordMembers: 1000,
    minRaffleEntries: null,
    requiredChains: ["ETHEREUM"],
    requiredAssetType: null,
    requireVerifiedTeam: false,
    customRules: [{ id: "doxxed", label: "Team is doxxed or KYC verified" }],
  };

  const listing = await db.whitelistListing.upsert({
    where: { slug: "lava-foxes-gtd-demo" },
    update: {},
    create: {
      teamId: lava.team.id,
      slug: "lava-foxes-gtd-demo",
      title: "Lava Foxes — GTD Whitelist",
      description:
        "200 guaranteed mint spots for aligned communities. We look for real, active holders — no farm DAOs.",
      bannerUrl: lava.team.bannerUrl,
      assetType: "NFT",
      chain: "ETHEREUM",
      collectionName: "Lava Foxes",
      collectionAddress: "0x0000000000000000000000000000000000001a7a",
      mintOrTgeAt: daysFromNow(21),
      totalSpots: 200,
      publicSpots: 40,
      spotsPerRequestMin: 5,
      spotsPerRequestMax: 50,
      distributionMethod: "CRITERIA",
      status: "OPEN",
      startAt: daysFromNow(-2),
      endAt: daysFromNow(10),
      createdById: lava.owner.id,
      criteria: {
        create: {
          ...criteria,
          customRules: criteria.customRules as unknown as Prisma.InputJsonValue,
        },
      },
    },
  });
  console.log(`  ✓ Collab listing: ${listing.title} (200 spots, 40 public)`);

  const archEval = evaluateEligibility(criteria, {
    communitySize: 18000,
    holderCount: 2400,
    twitterFollowers: 12000,
    discordMembers: 6500,
    raffleEntries: 0,
    chains: ["ETHEREUM", "BASE"],
    assetType: null,
    verifiedTeam: false,
    attestations: { doxxed: true },
  });
  const smallEval = evaluateEligibility(criteria, {
    communitySize: 900,
    holderCount: 120,
    twitterFollowers: 700,
    discordMembers: 300,
    raffleEntries: 0,
    chains: ["SOLANA"],
    assetType: null,
    verifiedTeam: false,
    attestations: {},
  });

  if ((await db.collabRequest.count({ where: { listingId: listing.id } })) === 0) {
    await db.collabRequest.create({
      data: {
        listingId: listing.id,
        requesterTeamId: arch.team.id,
        submittedById: arch.owner.id,
        status: archEval.eligible ? "UNDER_REVIEW" : "SUBMITTED",
        spotsRequested: 25,
        pitch:
          "Arch DAO runs weekly mint clubs for 6.5k verified collectors. We would distribute via a holder-only raffle.",
        audienceSummary: "Mostly ETH-native collectors, 40% hold 3+ blue chips.",
        communitySize: 18000,
        holderCount: 2400,
        twitterFollowers: 12000,
        discordMembers: 6500,
        requesterChains: ["ETHEREUM", "BASE"],
        evidence: { links: ["https://dune.com/example/arch-dao"], attestations: { doxxed: true } },
        walletForDelivery: "0x00000000000000000000000000000000000a2c4d",
        deliveryChain: "ETHEREUM",
        eligible: archEval.eligible,
        eligibilityScore: archEval.score,
        eligibility: archEval.checks as unknown as Prisma.InputJsonValue,
      },
    });
    await db.collabRequest.create({
      data: {
        listingId: listing.id,
        requesterTeamId: small.team.id,
        submittedById: small.owner.id,
        status: "SUBMITTED",
        spotsRequested: 40,
        pitch: "We are a young studio with a tight-knit community. Would love to collab!",
        communitySize: 900,
        holderCount: 120,
        twitterFollowers: 700,
        discordMembers: 300,
        requesterChains: ["SOLANA"],
        evidence: { links: [], attestations: {} },
        eligible: smallEval.eligible,
        eligibilityScore: smallEval.score,
        eligibility: smallEval.checks as unknown as Prisma.InputJsonValue,
      },
    });
    console.log(
      `    → requests: Arch DAO 25 (score ${archEval.score}), Small Labs 40 (score ${smallEval.score}, flagged)`
    );
  }

  // Public raffle for the 40 public spots — a normal giveaway linked to the listing.
  const raffle = await db.giveaway.upsert({
    where: { slug: "lava-foxes-public-wl-demo" },
    update: {},
    create: {
      teamId: lava.team.id,
      listingId: listing.id,
      slug: "lava-foxes-public-wl-demo",
      title: "Lava Foxes Public WL",
      description: "40 GTD whitelist spots for the public. Follow, hold a fox, enter.",
      prize: "GTD whitelist x 40",
      type: "RANDOM",
      status: "ACTIVE",
      visibility: "PUBLIC",
      chain: "ETHEREUM",
      winnersCount: 40,
      startAt: daysFromNow(-1),
      endAt: daysFromNow(9),
      xAccount: "lavafoxes",
      bannerUrl: lava.team.bannerUrl,
      createdById: lava.owner.id,
      requirements: {
        create: [
          { type: "TWITTER_FOLLOW", order: 0, config: { handle: "lavafoxes" } },
          {
            type: "NFT_HOLD",
            order: 1,
            config: {
              chain: "ETHEREUM",
              contractAddress: "0x0000000000000000000000000000000000001a7a",
              minCount: 1,
              label: "Lava Foxes",
            },
          },
        ],
      },
    },
  });
  console.log(`  ✓ Collab public raffle: ${raffle.title}`);

  // FCFS listing: 10 spots, 7 already reserved for Arch DAO.
  const fcfs = await db.whitelistListing.upsert({
    where: { slug: "lava-foxes-fcfs-demo" },
    update: {},
    create: {
      teamId: lava.team.id,
      slug: "lava-foxes-fcfs-demo",
      title: "Lava Foxes — FCFS Partner Allowlist",
      description: "10 FCFS allowlist spots. Qualified requests are approved instantly.",
      assetType: "NFT",
      chain: "ETHEREUM",
      collectionName: "Lava Foxes",
      totalSpots: 10,
      reservedSpots: 7,
      spotsPerRequestMin: 1,
      spotsPerRequestMax: 7,
      distributionMethod: "FCFS",
      status: "OPEN",
      startAt: daysFromNow(-1),
      endAt: daysFromNow(5),
      createdById: founderId,
      criteria: { create: { minCommunitySize: 1000 } },
    },
  });
  if ((await db.collabRequest.count({ where: { listingId: fcfs.id } })) === 0) {
    const request = await db.collabRequest.create({
      data: {
        listingId: fcfs.id,
        requesterTeamId: arch.team.id,
        submittedById: arch.owner.id,
        status: "APPROVED",
        spotsRequested: 7,
        spotsGranted: 7,
        pitch: "Arch DAO mint club — 7 spots for our core contributors.",
        communitySize: 18000,
        requesterChains: ["ETHEREUM"],
        eligible: true,
        eligibilityScore: 100,
        reviewedAt: new Date(),
      },
    });
    await db.collabAllocation.create({
      data: { listingId: fcfs.id, requestId: request.id, teamId: arch.team.id, spots: 7, status: "RESERVED" },
    });
  }
  console.log(`  ✓ Collab FCFS listing: ${fcfs.title} (7 of 10 reserved)`);
  console.log("   Collab logins:  lava@oxbot.app · arch@oxbot.app · small@oxbot.app");
}

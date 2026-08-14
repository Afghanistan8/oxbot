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
import { PrismaClient } from "@prisma/client";
import { generateUniqueCodes } from "../src/lib/giveaway/codes";

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

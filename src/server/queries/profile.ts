import "server-only";

import { db } from "@/lib/db";
import type { Blockchain } from "@prisma/client";

/**
 * Queries backing the participant-facing /profile page — the signed-in
 * user's own wallet, connected socials, and win history. Always scoped to
 * the caller's own userId; never accepts an arbitrary id from the client.
 */

export type PrimaryWallet = { chain: Blockchain; address: string; verified: boolean } | null;

export async function getPrimaryWallet(userId: string): Promise<PrimaryWallet> {
  const wallet = await db.wallet.findFirst({
    where: { userId, isPrimary: true },
    select: { chain: true, address: true, verified: true },
  });
  return wallet;
}

export type WinSummary = {
  giveawayId: string;
  giveawaySlug: string;
  giveawayTitle: string;
  teamName: string;
  prize: string;
  rank: number;
  selectedAt: Date;
};

/** Every giveaway the user has won, most recent first. */
export async function getUserWins(userId: string): Promise<WinSummary[]> {
  const wins = await db.winner.findMany({
    where: { userId },
    orderBy: { selectedAt: "desc" },
    select: {
      rank: true,
      selectedAt: true,
      giveaway: {
        select: {
          id: true,
          slug: true,
          title: true,
          prize: true,
          team: { select: { name: true } },
        },
      },
    },
  });

  return wins.map((w) => ({
    giveawayId: w.giveaway.id,
    giveawaySlug: w.giveaway.slug,
    giveawayTitle: w.giveaway.title,
    teamName: w.giveaway.team.name,
    prize: w.giveaway.prize,
    rank: w.rank,
    selectedAt: w.selectedAt,
  }));
}

import "server-only";

import { db } from "@/lib/db";
import { PROFILE_WALLET_CHAINS, type WalletAddresses } from "@/lib/constants";

/**
 * Queries backing the participant-facing /profile page — the signed-in
 * user's own wallet, connected socials, and win history. Always scoped to
 * the caller's own userId; never accepts an arbitrary id from the client.
 */

export async function getUserWallets(userId: string): Promise<WalletAddresses> {
  const rows = await db.wallet.findMany({
    where: { userId, chain: { in: [...PROFILE_WALLET_CHAINS] } },
    select: { chain: true, address: true },
  });
  const byChain = new Map(rows.map((r) => [r.chain, r.address]));
  return Object.fromEntries(
    PROFILE_WALLET_CHAINS.map((c) => [c, byChain.get(c) ?? ""])
  ) as WalletAddresses;
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

import type {
  Blockchain,
  GiveawayStatus,
  GiveawayType,
  GiveawayVisibility,
} from "@prisma/client";

/**
 * View-model shapes shared between server queries and client components.
 * Keeping these explicit avoids leaking private fields (e.g. entrant lists) to
 * public components.
 */

/** Public-safe giveaway card data. Never includes entrant details. */
export type GiveawayCardData = {
  id: string;
  slug: string;
  title: string;
  prize: string;
  bannerUrl: string | null;
  type: GiveawayType;
  chain: Blockchain;
  visibility: GiveawayVisibility;
  status: GiveawayStatus;
  startAt: Date;
  endAt: Date;
  winnersCount: number;
  hideEntryCount: boolean;
  /** Only present when the giveaway does not hide its count. */
  entryCount: number | null;
  team: {
    name: string;
    slug: string;
    logoUrl: string | null;
    xHandle: string | null;
  };
};

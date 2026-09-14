import type { AssetType, Blockchain } from "@prisma/client";

import { ALL_CHAINS } from "@/lib/constants";
import { ASSET_TYPES } from "@/lib/collab/constants";

/** Parse the desk's URL filters (chain / type / open / sort) defensively. */
export type SearchParams = { [key: string]: string | string[] | undefined };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.toUpperCase() : undefined);

export function parseListingParams(params: SearchParams) {
  const chain = one(params.chain) as Blockchain | undefined;
  const type = one(params.type) as AssetType | undefined;
  const sort = params.sort === "new" ? "new" : params.sort === "spots" ? "spots" : "ending";
  return {
    chain: chain && ALL_CHAINS.includes(chain) ? chain : undefined,
    type: type && ASSET_TYPES.includes(type) ? type : undefined,
    open: params.open === "1",
    sort: sort as "ending" | "new" | "spots",
  };
}

import type { Blockchain } from "@prisma/client";

import { env, integrations } from "@/lib/env";

/**
 * NFT / token holding checks for the NFT_HOLD and TOKEN_BALANCE entry tasks.
 *
 * Live mode (NFT_PROVIDER = alchemy | helius | rpc, with a key or RPC URL):
 *  - EVM (Ethereum, Base, Arbitrum, Polygon): plain JSON-RPC `eth_call` —
 *    ERC-721/20 `balanceOf`, ERC-20 `decimals`, and ERC-721 `ownerOf` for
 *    token-id allowlists. Works with any node: Alchemy URLs are built from
 *    ALCHEMY_API_KEY, or NFT_RPC_ETH is used for Ethereum.
 *  - Solana: Helius DAS `searchAssets` for collection holds; SPL balances via
 *    `getTokenAccountsByOwner` (Helius or NFT_RPC_SOLANA).
 *
 * Mock mode (default, or OXBOT_FORCE_MOCKS=1): `checkHolding` returns
 * `{ mocked: true, ok: null }` and the entry engine completes the task from a
 * saved wallet plus the entrant's "I hold this" attestation.
 *
 * Unlike the X checks, an RPC failure fails CLOSED with a retry message — a
 * token gate that lets everyone through on an outage isn't a gate.
 */

export type HoldingCheck = {
  /** null = not checked live (mock / unsupported chain) — caller decides. */
  ok: boolean | null;
  mocked: boolean;
  detail: string;
};

type HoldingInput = {
  kind: "NFT_HOLD" | "TOKEN_BALANCE";
  chain: Blockchain;
  contractAddress: string;
  owner: string;
  minCount?: number;
  tokenIds?: string[];
  minBalance?: string;
  label?: string;
};

const EVM_ALCHEMY_NETWORK: Partial<Record<Blockchain, string>> = {
  ETHEREUM: "eth-mainnet",
  BASE: "base-mainnet",
  ARBITRUM: "arb-mainnet",
  POLYGON: "polygon-mainnet",
};

function evmRpcUrl(chain: Blockchain): string | null {
  const network = EVM_ALCHEMY_NETWORK[chain];
  if (network && env.ALCHEMY_API_KEY) return `https://${network}.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`;
  if (chain === "ETHEREUM" && env.NFT_RPC_ETH) return env.NFT_RPC_ETH;
  return null;
}

function solanaRpcUrl(): string | null {
  if (env.HELIUS_API_KEY) return `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`;
  return env.NFT_RPC_SOLANA || null;
}

async function rpc<T>(url: string, method: string, params: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`RPC ${method} returned ${res.status}`);
    const json = (await res.json()) as { result?: T; error?: { message?: string } };
    if (json.error) throw new Error(json.error.message ?? `RPC ${method} error`);
    return json.result as T;
  } finally {
    clearTimeout(timer);
  }
}

const isEvmAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);
const pad32 = (hex: string) => hex.replace(/^0x/, "").toLowerCase().padStart(64, "0");

async function evmCall(url: string, to: string, data: string): Promise<bigint> {
  const out = await rpc<string>(url, "eth_call", [{ to, data }, "latest"]);
  return out && out !== "0x" ? BigInt(out) : BigInt(0);
}

/** Parse "12.5" into base units for `decimals`, without floating point. */
export function toBaseUnits(amount: string, decimals: number): bigint {
  const [whole = "0", frac = ""] = amount.trim().split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * BigInt(10) ** BigInt(decimals) + BigInt(fracPadded || "0");
}

async function checkEvm(input: HoldingInput, url: string): Promise<HoldingCheck> {
  if (!isEvmAddress(input.owner)) {
    return { ok: false, mocked: false, detail: "That wallet isn't a valid EVM (0x…) address." };
  }
  if (!isEvmAddress(input.contractAddress)) {
    return { ok: false, mocked: false, detail: "Misconfigured task — invalid contract address." };
  }
  const contract = input.contractAddress;
  const label = input.label || "the collection";

  if (input.kind === "NFT_HOLD") {
    const ids = input.tokenIds ?? [];
    if (ids.length) {
      // Token-id allowlist: count how many listed ids this wallet owns.
      let owned = 0;
      const need = Math.max(1, input.minCount ?? 1);
      for (const id of ids.slice(0, 100)) {
        const data = `0x6352211e${pad32(BigInt(id).toString(16))}`;
        try {
          const owner = await rpc<string>(url, "eth_call", [{ to: contract, data }, "latest"]);
          if (owner && owner.slice(-40).toLowerCase() === input.owner.slice(2).toLowerCase()) owned += 1;
        } catch {
          // ownerOf reverts for burned/nonexistent ids — not owned.
        }
        if (owned >= need) break;
      }
      return owned >= need
        ? { ok: true, mocked: false, detail: `Holds ${owned} eligible ${label} token${owned === 1 ? "" : "s"}.` }
        : { ok: false, mocked: false, detail: `Hold ${need} of the eligible ${label} token ids to enter.` };
    }
    const balance = await evmCall(url, contract, `0x70a08231${pad32(input.owner)}`);
    const need = BigInt(Math.max(1, input.minCount ?? 1));
    return balance >= need
      ? { ok: true, mocked: false, detail: `Holds ${balance} ${label}.` }
      : { ok: false, mocked: false, detail: `Hold at least ${need} ${label} NFT${need === BigInt(1) ? "" : "s"} (found ${balance}).` };
  }

  const [balance, decimals] = await Promise.all([
    evmCall(url, contract, `0x70a08231${pad32(input.owner)}`),
    evmCall(url, contract, "0x313ce567").catch(() => BigInt(18)),
  ]);
  const need = toBaseUnits(input.minBalance ?? "0", Number(decimals));
  return balance >= need
    ? { ok: true, mocked: false, detail: `Balance meets the ${input.minBalance} ${label} minimum.` }
    : { ok: false, mocked: false, detail: `Hold at least ${input.minBalance} ${label} to enter.` };
}

async function checkSolana(input: HoldingInput, url: string): Promise<HoldingCheck> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input.owner)) {
    return { ok: false, mocked: false, detail: "That wallet isn't a valid Solana address." };
  }
  const label = input.label || "the collection";

  if (input.kind === "NFT_HOLD" && env.HELIUS_API_KEY) {
    const result = await rpc<{ total?: number; items?: unknown[] }>(url, "searchAssets", {
      ownerAddress: input.owner,
      grouping: ["collection", input.contractAddress],
      page: 1,
      limit: 1000,
    });
    const count = result.total ?? result.items?.length ?? 0;
    const need = Math.max(1, input.minCount ?? 1);
    return count >= need
      ? { ok: true, mocked: false, detail: `Holds ${count} ${label}.` }
      : { ok: false, mocked: false, detail: `Hold at least ${need} ${label} NFT${need === 1 ? "" : "s"} (found ${count}).` };
  }

  // SPL balance by mint (also used for NFT_HOLD against a single mint without DAS).
  type Parsed = { value: { account: { data: { parsed: { info: { tokenAmount: { amount: string; decimals: number } } } } } }[] };
  const res = await rpc<Parsed>(url, "getTokenAccountsByOwner", [
    input.owner,
    { mint: input.contractAddress },
    { encoding: "jsonParsed" },
  ]);
  let raw = BigInt(0);
  let decimals = 0;
  for (const acc of res.value ?? []) {
    const amt = acc.account.data.parsed.info.tokenAmount;
    raw += BigInt(amt.amount);
    decimals = amt.decimals;
  }
  if (input.kind === "NFT_HOLD") {
    const need = BigInt(Math.max(1, input.minCount ?? 1));
    return raw >= need
      ? { ok: true, mocked: false, detail: `Holds ${label}.` }
      : { ok: false, mocked: false, detail: `Hold ${label} to enter.` };
  }
  const need = toBaseUnits(input.minBalance ?? "0", decimals);
  return raw >= need
    ? { ok: true, mocked: false, detail: `Balance meets the ${input.minBalance} ${label} minimum.` }
    : { ok: false, mocked: false, detail: `Hold at least ${input.minBalance} ${label} to enter.` };
}

/** Check one wallet against a holding requirement. Never throws. */
export async function checkHolding(input: HoldingInput): Promise<HoldingCheck> {
  if (!integrations.nft.live) {
    return { ok: null, mocked: true, detail: "Mock: holdings aren't checked on-chain." };
  }
  try {
    if (input.chain === "SOLANA") {
      const url = solanaRpcUrl();
      if (url) return await checkSolana(input, url);
    } else {
      const url = evmRpcUrl(input.chain);
      if (url) return await checkEvm(input, url);
    }
    return { ok: null, mocked: true, detail: "On-chain checks aren't configured for this chain." };
  } catch (e) {
    console.warn("[nft] holding check failed:", e);
    return { ok: false, mocked: false, detail: "Couldn't verify your holdings right now — try again in a moment." };
  }
}

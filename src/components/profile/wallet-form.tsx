"use client";

import { useActionState } from "react";

import { saveWalletsAction } from "@/server/actions/profile";
import { ActionState } from "@/server/actions/_result";
import { CHAIN_META, PROFILE_WALLET_CHAINS, type WalletAddresses } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/dashboard/submit-button";
import { FormMessage } from "@/components/dashboard/form-message";

const initial: ActionState = { ok: false };

const PLACEHOLDER: Record<string, string> = {
  SOLANA: "e.g. 9WzD…AWWM",
  ETHEREUM: "0x…",
  ROBINHOOD: "0x…",
  BASE: "0x…",
  ARBITRUM: "0x…",
};

/**
 * WalletsForm — one plain address field per supported chain. Paste an
 * address and hit Save; a blank field on save clears that chain's address.
 * No "connect" step, no verification — this is a profile field used to
 * satisfy WALLET entry requirements, not a login credential.
 */
export function WalletsForm({ wallets }: { wallets: WalletAddresses }) {
  const [state, formAction] = useActionState(saveWalletsAction, initial);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        {PROFILE_WALLET_CHAINS.map((chain) => (
          <div key={chain}>
            <Label htmlFor={`wallet_${chain}`} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: CHAIN_META[chain].color }}
              />
              {CHAIN_META[chain].label}
            </Label>
            <Input
              id={`wallet_${chain}`}
              name={`wallet_${chain}`}
              defaultValue={wallets[chain]}
              placeholder={PLACEHOLDER[chain]}
              maxLength={120}
              className="font-mono text-sm"
            />
          </div>
        ))}
      </div>

      <SubmitButton pendingText="Saving…">Save wallets</SubmitButton>
    </form>
  );
}

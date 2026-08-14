"use client";

import { useActionState, useEffect, useState } from "react";
import { ShieldCheck, Wallet as WalletIcon, Pencil } from "lucide-react";

import { setPrimaryWalletAction } from "@/server/actions/profile";
import { ActionState } from "@/server/actions/_result";
import { ALL_CHAINS, CHAIN_META } from "@/lib/constants";
import { shortenAddress } from "@/lib/utils";
import type { Blockchain } from "@prisma/client";
import type { PrimaryWallet } from "@/server/queries/profile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/dashboard/submit-button";
import { FormMessage, FieldError } from "@/components/dashboard/form-message";

const initial: ActionState = { ok: false };

/**
 * WalletForm — manages the account's single primary wallet. Setting it the
 * first time is a plain form; once set, editing requires a CAPTCHA pass
 * (auto-satisfied in mock mode, matching the entry-wizard's CAPTCHA pattern).
 */
export function WalletForm({ wallet }: { wallet: PrimaryWallet }) {
  const [state, formAction] = useActionState(setPrimaryWalletAction, initial);
  const [editing, setEditing] = useState(!wallet);
  const [chain, setChain] = useState<Blockchain>(wallet?.chain ?? "ETHEREUM");

  useEffect(() => {
    if (state.ok) setEditing(false);
    // Re-run on every new action result, not just when `ok` flips true→false —
    // consecutive successful saves (e.g. change → change again) otherwise leave
    // the form stuck open because `state.ok` stays `true` across them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!editing && wallet) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-ink-black/30 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card/60">
            <WalletIcon className="h-4 w-4 text-scarlet-soft" />
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-white">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: CHAIN_META[wallet.chain].color }}
              />
              {CHAIN_META[wallet.chain].label}
            </p>
            <p className="font-mono text-xs text-muted-foreground" title={wallet.address}>
              {shortenAddress(wallet.address)}
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
          Change
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      {wallet && (
        <p className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-scarlet-soft">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          Changing your wallet requires a CAPTCHA check.
        </p>
      )}
      <FormMessage state={state} />

      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <div>
          <Label>Chain</Label>
          <Select value={chain} onValueChange={(v) => setChain(v as Blockchain)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_CHAINS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CHAIN_META[c].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="chain" value={chain} />
        </div>
        <div>
          <Label htmlFor="address">Wallet address</Label>
          <Input
            id="address"
            name="address"
            defaultValue={wallet?.address ?? ""}
            placeholder="0x… or your chain address"
            maxLength={120}
            required
          />
          <FieldError errors={state.fieldErrors?.address} />
        </div>
      </div>

      {/* A real CAPTCHA widget would populate this token; mock mode auto-passes. */}
      <input type="hidden" name="captchaToken" value="" />

      <div className="flex items-center gap-2">
        <SubmitButton pendingText="Saving…">
          {wallet ? "Save new wallet" : "Connect wallet"}
        </SubmitButton>
        {wallet && (
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

"use client";

import { Plus, Trash2, Wand2 } from "lucide-react";
import type { AssetType, Blockchain } from "@prisma/client";

import type { CriteriaInput } from "@/lib/collab/eligibility";
import { ASSET_TYPES, ASSET_TYPE_META } from "@/lib/collab/constants";
import { summarizeCriteria } from "@/lib/collab/format";
import { ALL_CHAINS, CHAIN_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * CriteriaEditor — a controlled editor for a listing's qualification rules.
 * The parent owns a {@link CriteriaDraft}; `serializeCriteria` turns it into
 * the JSON blob `criteriaSchema` validates server-side. Used by the listing
 * form and the criteria-templates page.
 */

export type CriteriaDraft = {
  minCommunitySize: string;
  minHolderCount: string;
  minTwitterFollowers: string;
  minDiscordMembers: string;
  minRaffleEntries: string;
  requiredChains: Blockchain[];
  requiredAssetType: AssetType | "";
  requireVerifiedTeam: boolean;
  customRules: { id: string; label: string }[];
};

const NUMBER_FIELDS: { key: keyof CriteriaDraft & `min${string}`; label: string; hint: string }[] = [
  { key: "minCommunitySize", label: "Community size", hint: "Total audience across channels" },
  { key: "minTwitterFollowers", label: "X followers", hint: "Project account" },
  { key: "minDiscordMembers", label: "Discord members", hint: "Server members" },
  { key: "minHolderCount", label: "Holders", hint: "Unique holders of their asset" },
  { key: "minRaffleEntries", label: "oxbot raffle entries", hint: "Verified by oxbot — completed entries" },
];

export function draftFromCriteria(c: CriteriaInput | null | undefined): CriteriaDraft {
  const s = (n: number | null | undefined) => (n ? String(n) : "");
  return {
    minCommunitySize: s(c?.minCommunitySize),
    minHolderCount: s(c?.minHolderCount),
    minTwitterFollowers: s(c?.minTwitterFollowers),
    minDiscordMembers: s(c?.minDiscordMembers),
    minRaffleEntries: s(c?.minRaffleEntries),
    requiredChains: c?.requiredChains ?? [],
    requiredAssetType: c?.requiredAssetType ?? "",
    requireVerifiedTeam: c?.requireVerifiedTeam ?? false,
    customRules: c?.customRules ?? [],
  };
}

export function serializeCriteria(d: CriteriaDraft): string {
  const n = (v: string) => (v.trim() === "" ? null : v.replace(/[,\s]/g, ""));
  return JSON.stringify({
    minCommunitySize: n(d.minCommunitySize),
    minHolderCount: n(d.minHolderCount),
    minTwitterFollowers: n(d.minTwitterFollowers),
    minDiscordMembers: n(d.minDiscordMembers),
    minRaffleEntries: n(d.minRaffleEntries),
    requiredChains: d.requiredChains,
    requiredAssetType: d.requiredAssetType || null,
    requireVerifiedTeam: d.requireVerifiedTeam,
    customRules: d.customRules.filter((r) => r.label.trim()),
  });
}

let ruleCounter = 0;
function newRuleId() {
  ruleCounter += 1;
  return `r${Date.now().toString(36)}${ruleCounter}`;
}

export function CriteriaEditor({
  value,
  onChange,
  templates = [],
  disabled = false,
}: {
  value: CriteriaDraft;
  onChange: (next: CriteriaDraft) => void;
  templates?: { id: string; name: string; criteria: CriteriaInput }[];
  disabled?: boolean;
}) {
  const patch = (changes: Partial<CriteriaDraft>) => onChange({ ...value, ...changes });

  function toggleChain(chain: Blockchain) {
    const has = value.requiredChains.includes(chain);
    patch({ requiredChains: has ? value.requiredChains.filter((c) => c !== chain) : [...value.requiredChains, chain] });
  }

  return (
    <div className="space-y-6">
      {templates.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-ink-black/40 px-4 py-3">
          <p className="text-xs text-muted-foreground">Start from one of your saved criteria templates.</p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={disabled}>
                <Wand2 className="h-3.5 w-3.5" />
                Apply template
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Templates</DropdownMenuLabel>
              {templates.map((t) => (
                <DropdownMenuItem key={t.id} onSelect={() => onChange(draftFromCriteria(t.criteria))}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{t.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{summarizeCriteria(t.criteria)}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Minimums</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NUMBER_FIELDS.map((f) => (
            <div key={f.key}>
              <Label htmlFor={`crit-${f.key}`}>{f.label}</Label>
              <Input
                id={`crit-${f.key}`}
                inputMode="numeric"
                value={value[f.key]}
                onChange={(e) => patch({ [f.key]: e.target.value.replace(/[^\d,]/g, "") } as Partial<CriteriaDraft>)}
                placeholder="No minimum"
                disabled={disabled}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">{f.hint}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Requester chain <span className="normal-case tracking-normal">(any of — leave empty for all)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {ALL_CHAINS.map((c) => {
            const active = value.requiredChains.includes(c);
            return (
              <button
                key={c}
                type="button"
                disabled={disabled}
                onClick={() => toggleChain(c)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                  active
                    ? "border-primary/60 bg-primary/15 text-white shadow-glow-red"
                    : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-white"
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHAIN_META[c].color }} />
                {CHAIN_META[c].label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="crit-assetType">Requester project type</Label>
          <select
            id="crit-assetType"
            value={value.requiredAssetType}
            onChange={(e) => patch({ requiredAssetType: e.target.value as AssetType | "" })}
            disabled={disabled}
            className="flex h-10 w-full rounded-xl border border-input bg-ink-charcoal/60 px-3 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <option value="">Any type</option>
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {ASSET_TYPE_META[t].label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card/40 p-4">
          <div>
            <p className="text-sm font-medium text-white">Verified projects only</p>
            <p className="text-xs text-muted-foreground">Logo, socials, and at least one published drop on oxbot.</p>
          </div>
          <Switch
            checked={value.requireVerifiedTeam}
            onCheckedChange={(v) => patch({ requireVerifiedTeam: v })}
            disabled={disabled}
            aria-label="Verified projects only"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Custom rules <span className="normal-case tracking-normal">(requesters must attest each)</span>
        </p>
        <div className="space-y-2">
          {value.customRules.map((rule) => (
            <div key={rule.id} className="flex items-center gap-2">
              <Input
                value={rule.label}
                onChange={(e) =>
                  patch({
                    customRules: value.customRules.map((r) => (r.id === rule.id ? { ...r, label: e.target.value } : r)),
                  })
                }
                placeholder="e.g. Team is doxxed or KYC verified"
                maxLength={140}
                disabled={disabled}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => patch({ customRules: value.customRules.filter((r) => r.id !== rule.id) })}
                disabled={disabled}
                aria-label="Remove rule"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {value.customRules.length < 10 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => patch({ customRules: [...value.customRules, { id: newRuleId(), label: "" }] })}
            >
              <Plus className="h-3.5 w-3.5" />
              Add rule
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

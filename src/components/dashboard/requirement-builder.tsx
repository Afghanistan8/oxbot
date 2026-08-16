"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Mail,
  KeyRound,
  UserPlus,
  Heart,
  Repeat2,
  MessageCircle,
  Shield,
  Wallet,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Loader2,
  RefreshCw,
  CircleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Blockchain, RequirementType } from "@prisma/client";

import { REQUIREMENT_META, ALL_CHAINS, CHAIN_META } from "@/lib/constants";
import type { ManagedRequirement } from "@/server/queries/dashboard";
import { fetchGuildRolesAction } from "@/server/actions/discord";
import type { GuildRole } from "@/lib/integrations/discord";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * RequirementBuilder — a controlled editor for a giveaway's entry requirements.
 *
 * The parent form owns the `ReqDraft[]` state; on submit it serializes the
 * drafts to a JSON blob (via `serializeRequirements`) carried in a hidden field.
 * Each requirement type reveals only its own config inputs.
 */

export type ReqDraft = {
  key: string;
  type: RequirementType;
  required: boolean;
  handle: string;
  tweetUrl: string;
  roleIds: string; // comma/space separated in the UI
  inviteUrl: string;
  caseSensitive: boolean;
  chain: Blockchain | "";
};

const ICONS: Record<RequirementType, LucideIcon> = {
  CAPTCHA: ShieldCheck,
  EMAIL: Mail,
  CODE: KeyRound,
  TWITTER_FOLLOW: UserPlus,
  TWITTER_LIKE: Heart,
  TWITTER_RETWEET: Repeat2,
  DISCORD_MEMBER: MessageCircle,
  DISCORD_ROLE: Shield,
  WALLET: Wallet,
};

const ADD_GROUPS: { label: string; types: RequirementType[] }[] = [
  { label: "Basics", types: ["CAPTCHA", "EMAIL", "CODE"] },
  { label: "X (Twitter)", types: ["TWITTER_FOLLOW", "TWITTER_LIKE", "TWITTER_RETWEET"] },
  { label: "Discord", types: ["DISCORD_MEMBER", "DISCORD_ROLE"] },
  { label: "Wallet", types: ["WALLET"] },
];

let keyCounter = 0;
/** Stable local key for a new draft (avoids Math.random / index keys). */
export function nextReqKey(): string {
  keyCounter += 1;
  return `req-${keyCounter}`;
}

export function emptyDraft(type: RequirementType): ReqDraft {
  return {
    key: nextReqKey(),
    type,
    required: type === "WALLET" ? false : true,
    handle: "",
    tweetUrl: "",
    roleIds: "",
    inviteUrl: "",
    caseSensitive: false,
    chain: "",
  };
}

/** Hydrate drafts from persisted requirements (edit mode). */
export function draftsFromRequirements(reqs: ManagedRequirement[]): ReqDraft[] {
  return reqs.map((r) => {
    const c = r.config as Record<string, unknown>;
    const roleIds = Array.isArray(c.roleIds) ? (c.roleIds as string[]).join(", ") : "";
    return {
      key: nextReqKey(),
      type: r.type,
      required: r.required,
      handle: typeof c.handle === "string" ? c.handle : "",
      tweetUrl: typeof c.tweetUrl === "string" ? c.tweetUrl : "",
      roleIds,
      inviteUrl: typeof c.inviteUrl === "string" ? c.inviteUrl : "",
      caseSensitive: Boolean(c.caseSensitive),
      chain: typeof c.chain === "string" ? (c.chain as Blockchain) : "",
    };
  });
}

/** Convert drafts into the shape expected by `requirementSchema` on the server. */
export function serializeRequirements(drafts: ReqDraft[]): unknown[] {
  return drafts.map((d) => {
    const base = { type: d.type, required: d.required };
    switch (d.type) {
      case "CODE":
        return { ...base, caseSensitive: d.caseSensitive };
      case "TWITTER_FOLLOW":
        return { ...base, handle: d.handle.trim() };
      case "TWITTER_LIKE":
      case "TWITTER_RETWEET":
        return { ...base, tweetUrl: d.tweetUrl.trim() };
      case "DISCORD_MEMBER":
      case "DISCORD_ROLE": {
        const roleIds = d.roleIds
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        return { ...base, roleIds, inviteUrl: d.inviteUrl.trim() };
      }
      case "WALLET": {
        const out: Record<string, unknown> = { ...base };
        if (d.chain) out.chain = d.chain;
        return out;
      }
      default:
        return base; // CAPTCHA, EMAIL
    }
  });
}

/** Best-effort client-side check so we don't submit obviously-empty configs. */
export function requirementDraftError(d: ReqDraft): string | null {
  switch (d.type) {
    case "TWITTER_FOLLOW":
      return d.handle.trim() ? null : "Enter the X handle to follow.";
    case "TWITTER_LIKE":
    case "TWITTER_RETWEET":
      return d.tweetUrl.trim() ? null : "Enter the post URL.";
    case "DISCORD_MEMBER":
      return d.inviteUrl.trim() ? null : "Enter the server's invite URL.";
    case "DISCORD_ROLE":
      if (!d.inviteUrl.trim()) return "Enter the server's invite URL.";
      return d.roleIds.split(/[\s,]+/).filter(Boolean).length
        ? null
        : "Add at least one Discord role.";
    default:
      return null;
  }
}

export function RequirementBuilder({
  value,
  onChange,
  disabled = false,
  discordServerId = "",
}: {
  value: ReqDraft[];
  onChange: (next: ReqDraft[]) => void;
  disabled?: boolean;
  /** Current value of the giveaway's "Discord server ID" field (Project links),
   *  so the DISCORD_ROLE picker knows which guild to fetch roles from. */
  discordServerId?: string;
}) {
  function add(type: RequirementType) {
    onChange([...value, emptyDraft(type)]);
  }
  function remove(key: string) {
    onChange(value.filter((d) => d.key !== key));
  }
  function patch(key: string, changes: Partial<ReqDraft>) {
    onChange(value.map((d) => (d.key === key ? { ...d, ...changes } : d)));
  }
  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {value.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No tasks yet. Add requirements participants must complete to enter.
          </p>
        </div>
      )}

      {value.map((draft, i) => {
        const meta = REQUIREMENT_META[draft.type];
        const Icon = ICONS[draft.type];
        const err = requirementDraftError(draft);
        return (
          <div
            key={draft.key}
            className="rounded-2xl border border-border bg-card/60 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 hidden text-muted-foreground sm:block">
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">{meta.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={disabled || i === 0}
                      onClick={() => move(i, -1)}
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={disabled || i === value.length - 1}
                      onClick={() => move(i, 1)}
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      disabled={disabled}
                      onClick={() => remove(draft.key)}
                      aria-label="Remove requirement"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Per-type config */}
                <ConfigFields
                  draft={draft}
                  patch={patch}
                  disabled={disabled}
                  discordServerId={discordServerId}
                />

                {err && <p className="mt-2 text-xs text-amber-300/90">{err}</p>}

                {/* Required toggle (WALLET is optional in Phase 1) */}
                <div className="mt-3 flex items-center gap-2">
                  <Switch
                    id={`req-${draft.key}`}
                    checked={draft.required}
                    onCheckedChange={(v) => patch(draft.key, { required: v })}
                    disabled={disabled}
                  />
                  <Label htmlFor={`req-${draft.key}`} className="text-xs text-muted-foreground">
                    {draft.required ? "Required to enter" : "Optional bonus task"}
                  </Label>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" disabled={disabled} className="w-full">
            <Plus className="h-4 w-4" />
            Add requirement
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {ADD_GROUPS.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
              {group.types.map((type) => {
                const Icon = ICONS[type];
                return (
                  <DropdownMenuItem
                    key={type}
                    onSelect={() => add(type)}
                    className="cursor-pointer gap-2"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {REQUIREMENT_META[type].label}
                  </DropdownMenuItem>
                );
              })}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ConfigFields({
  draft,
  patch,
  disabled,
  discordServerId,
}: {
  draft: ReqDraft;
  patch: (key: string, changes: Partial<ReqDraft>) => void;
  disabled: boolean;
  discordServerId: string;
}) {
  const k = draft.key;
  switch (draft.type) {
    case "TWITTER_FOLLOW":
      return (
        <Field className="mt-3">
          <Label htmlFor={`h-${k}`}>Handle to follow</Label>
          <div className="flex items-center">
            <span className="inline-flex h-10 items-center rounded-l-xl border border-r-0 border-input bg-ink-black/60 px-3 text-sm text-muted-foreground">
              @
            </span>
            <Input
              id={`h-${k}`}
              value={draft.handle}
              onChange={(e) => patch(k, { handle: e.target.value })}
              placeholder="yourproject"
              className="rounded-l-none"
              disabled={disabled}
            />
          </div>
        </Field>
      );
    case "TWITTER_LIKE":
    case "TWITTER_RETWEET":
      return (
        <Field className="mt-3">
          <Label htmlFor={`t-${k}`}>Post URL</Label>
          <Input
            id={`t-${k}`}
            value={draft.tweetUrl}
            onChange={(e) => patch(k, { tweetUrl: e.target.value })}
            placeholder="https://x.com/…/status/…"
            disabled={disabled}
          />
        </Field>
      );
    case "DISCORD_MEMBER":
      return (
        <div className="mt-3 space-y-3">
          <Field>
            <Label htmlFor={`i-${k}`}>Server invite URL</Label>
            <Input
              id={`i-${k}`}
              value={draft.inviteUrl}
              onChange={(e) => patch(k, { inviteUrl: e.target.value })}
              placeholder="https://discord.gg/…"
              disabled={disabled}
              required
            />
          </Field>
          <DiscordRolePicker
            roleIds={draft.roleIds}
            onChange={(roleIds) => patch(k, { roleIds })}
            disabled={disabled}
            discordServerId={discordServerId}
            optional
          />
        </div>
      );
    case "DISCORD_ROLE":
      return (
        <div className="mt-3 space-y-3">
          <Field>
            <Label htmlFor={`i-${k}`}>Server invite URL</Label>
            <Input
              id={`i-${k}`}
              value={draft.inviteUrl}
              onChange={(e) => patch(k, { inviteUrl: e.target.value })}
              placeholder="https://discord.gg/…"
              disabled={disabled}
              required
            />
          </Field>
          <DiscordRolePicker
            roleIds={draft.roleIds}
            onChange={(roleIds) => patch(k, { roleIds })}
            disabled={disabled}
            discordServerId={discordServerId}
          />
        </div>
      );
    case "CODE":
      return (
        <label className="mt-3 flex items-center gap-2">
          <Checkbox
            checked={draft.caseSensitive}
            onCheckedChange={(v) => patch(k, { caseSensitive: v === true })}
            disabled={disabled}
          />
          <span className="text-sm text-muted-foreground">Codes are case-sensitive</span>
        </label>
      );
    case "WALLET":
      return (
        <Field className="mt-3">
          <Label htmlFor={`c-${k}`}>Chain (optional)</Label>
          <select
            id={`c-${k}`}
            value={draft.chain}
            onChange={(e) => patch(k, { chain: e.target.value as Blockchain | "" })}
            disabled={disabled}
            className="flex h-10 w-full rounded-xl border border-input bg-ink-charcoal/60 px-3 text-sm text-foreground focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 sm:max-w-xs"
          >
            <option value="">Any chain</option>
            {ALL_CHAINS.map((chain) => (
              <option key={chain} value={chain}>
                {CHAIN_META[chain].label}
              </option>
            ))}
          </select>
        </Field>
      );
    default:
      return null; // CAPTCHA, EMAIL need no config
  }
}

function Field({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-1.5", className)}>{children}</div>;
}

function parseRoleIds(raw: string): Set<string> {
  return new Set(raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean));
}

/**
 * DiscordRolePicker — fetches the real roles from the server set under
 * Project links (via the oxbot bot) and lets the founder toggle exactly
 * which ones qualify, instead of pasting raw role IDs blind. Falls back to
 * a plain "paste IDs" field when the bot isn't configured, the guild hasn't
 * had the bot invited yet, or the fetch simply fails — never a dead end.
 */
function DiscordRolePicker({
  roleIds,
  onChange,
  disabled,
  discordServerId,
  optional = false,
}: {
  roleIds: string;
  onChange: (roleIds: string) => void;
  disabled: boolean;
  discordServerId: string;
  /** On "Join Discord", roles merely narrow the check and may be left empty. */
  optional?: boolean;
}) {
  const [roles, setRoles] = useState<GuildRole[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = parseRoleIds(roleIds);
  const guildId = discordServerId.trim();

  async function load() {
    if (!guildId) return;
    setLoading(true);
    setError(null);
    const res = await fetchGuildRolesAction(guildId);
    setLoading(false);
    if (res.ok) {
      setRoles(res.roles);
    } else {
      setRoles(null);
      setError(res.error);
    }
  }

  function toggleRole(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next].join(", "));
  }

  return (
    <Field>
      <div className="flex items-center justify-between gap-3">
        <Label>
          Required roles{" "}
          {optional && (
            <span className="font-normal text-muted-foreground">
              (optional — any member qualifies if none selected)
            </span>
          )}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || loading || !guildId}
          onClick={load}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : roles ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <MessageCircle className="h-3.5 w-3.5" />
          )}
          {roles ? "Refresh roles" : "Load roles from Discord"}
        </Button>
      </div>

      {!guildId && (
        <p className="text-xs text-muted-foreground">
          Set a Discord server ID under Project links below, then load its roles.
        </p>
      )}

      {error && (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {roles && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-ink-black/30 p-3">
          {roles.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              This server has no assignable roles besides @everyone.
            </p>
          ) : (
            roles.map((role) => {
              const active = selected.has(role.id);
              return (
                <button
                  key={role.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleRole(role.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                    active
                      ? "border-primary/60 bg-primary/15 text-white shadow-glow-red"
                      : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-white"
                  )}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }} />
                  {role.name}
                </button>
              );
            })
          )}
        </div>
      )}

      <details className="group">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-white">
          {roles ? "Or edit role IDs manually" : "Paste role IDs manually instead"}
        </summary>
        <Input
          value={roleIds}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Comma-separated role IDs"
          disabled={disabled}
          className="mt-2"
        />
      </details>

      <p className="text-xs text-muted-foreground">
        {optional
          ? "Leave empty to accept any member. Select roles to require at least one of them."
          : "Members holding any of these roles qualify."}{" "}
        Checked against the Discord server set under Project links below.
      </p>
    </Field>
  );
}

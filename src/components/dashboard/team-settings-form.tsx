"use client";

import { useActionState, useState } from "react";
import {
  Globe,
  MessageCircle,
  Send,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  CalendarClock,
} from "lucide-react";

import { updateTeamAction } from "@/server/actions/team";
import { oauthSignInAction } from "@/server/actions/auth";
import { ActionState } from "@/server/actions/_result";
import { ALL_CHAINS, CHAIN_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Blockchain, Team } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { ImageUploadField } from "@/components/dashboard/image-upload-field";

const initial: ActionState = { ok: false };

/** Format a Date as a `datetime-local` input value in the viewer's local time. */
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

type ConnectionSummary = {
  provider: string;
  username: string | null;
  displayName: string | null;
} | null;

/**
 * TeamSettingsForm — project brand, branding assets, connected socials +
 * verification, blockchain/mint details, and supported chains. Bound to the
 * team id so the action can authorize + target the right team.
 */
export function TeamSettingsForm({
  team,
  twitterConnection,
  discordConnection,
  twitterOauthLive,
  discordOauthLive,
  discordBotInviteUrl,
  callbackUrl,
}: {
  team: Team;
  twitterConnection: ConnectionSummary;
  discordConnection: ConnectionSummary;
  twitterOauthLive: boolean;
  discordOauthLive: boolean;
  discordBotInviteUrl: string | null;
  callbackUrl: string;
}) {
  const action = updateTeamAction.bind(null, team.id);
  const [state, formAction] = useActionState(action, initial);

  const [chains, setChains] = useState<Set<Blockchain>>(
    new Set(team.chains as Blockchain[])
  );
  const [primaryChain, setPrimaryChain] = useState<Blockchain | "">(
    team.primaryChain ?? ""
  );
  const [mintTba, setMintTba] = useState(team.mintTba);
  const [mintAt, setMintAt] = useState(team.mintAt ? toLocalInputValue(team.mintAt) : "");

  // The project's public X handle is a plain text field — it is NOT the same
  // thing as the admin's personal OAuth-linked account. We only claim the
  // handle is "verified" when the connected account actually proves ownership
  // of it (same username), so entering "LavaFoxes" never gets falsely stamped
  // with whatever personal account happens to be signed in.
  const connectedXUsername = twitterConnection?.username ?? null;
  const [xHandle, setXHandle] = useState((team.xHandle ?? "").replace(/^@+/, ""));
  const normalizedXHandle = xHandle.replace(/^@+/, "").trim();
  const xVerified =
    !!normalizedXHandle &&
    !!connectedXUsername &&
    normalizedXHandle.toLowerCase() === connectedXUsername.toLowerCase();
  const personalXDiffers =
    !!connectedXUsername &&
    normalizedXHandle.toLowerCase() !== connectedXUsername.toLowerCase();

  function toggleChain(chain: Blockchain) {
    setChains((prev) => {
      const next = new Set(prev);
      if (next.has(chain)) next.delete(chain);
      else next.add(chain);
      return next;
    });
  }

  return (
    <div className="space-y-8">
      {/* Account-linking prompts — their OWN forms, never nested inside the
          settings form (HTML forbids nested forms). */}
      {(twitterOauthLive || discordOauthLive) && (
        <div className="flex flex-wrap gap-2">
          {twitterOauthLive && !twitterConnection && (
            <ConnectButton provider="twitter" label="Connect X" callbackUrl={callbackUrl} />
          )}
          {discordOauthLive && !discordConnection && (
            <ConnectButton provider="discord" label="Connect Discord" callbackUrl={callbackUrl} />
          )}
        </div>
      )}

      <form action={formAction} className="space-y-8">
        <FormMessage state={state} />

        {/* --- Basics --- */}
        <Section title="Basics" description="What is your project?">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Project name</Label>
              <Input id="name" name="name" defaultValue={team.name} required maxLength={60} />
              <FieldError errors={state.fieldErrors?.name} />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="description">Bio / description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={team.description ?? ""}
                rows={3}
                maxLength={500}
                placeholder="A concise overview of your project, ecosystem, or utility."
              />
              <FieldError errors={state.fieldErrors?.description} />
            </div>

            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                type="url"
                defaultValue={team.website ?? ""}
                placeholder="https://…"
              />
              <FieldError errors={state.fieldErrors?.website} />
            </div>
          </div>
        </Section>

        {/* --- Branding assets --- */}
        <Section title="Branding assets" description="Shown on your public project page.">
          <div className="grid gap-5 sm:grid-cols-2">
            <ImageUploadField
              name="logoUrl"
              label="Logo / profile image"
              folder="logos"
              aspect="square"
              defaultValue={team.logoUrl}
            />
            <ImageUploadField
              name="bannerUrl"
              label="Banner image"
              folder="banners"
              aspect="wide"
              defaultValue={team.bannerUrl}
            />
          </div>
        </Section>

        {/* --- Connected socials & verification --- */}
        <Section
          title="Connected socials & verification"
          description="Connect your official accounts to verify ownership and power entry requirements."
        >
          <div className="space-y-5">
            {/* X (Twitter) */}
            <div className="rounded-2xl border border-border bg-ink-black/30 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-scarlet-soft" />
                  <p className="text-sm font-medium text-white">Official X (Twitter) account</p>
                </div>
                <XHandleBadge
                  handle={normalizedXHandle}
                  verified={xVerified}
                  oauthLive={twitterOauthLive}
                />
              </div>
              <div className="flex items-center">
                <span className="inline-flex h-10 items-center rounded-l-xl border border-r-0 border-input bg-ink-black/60 px-3 text-sm text-muted-foreground">
                  @
                </span>
                <Input
                  id="xHandle"
                  name="xHandle"
                  value={xHandle}
                  onChange={(e) => setXHandle(e.target.value.replace(/^@+/, ""))}
                  placeholder="yourproject"
                  className="rounded-l-none"
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                This is your project&apos;s public handle — entrants follow it to
                complete follow tasks. To earn the verified badge, sign in with
                this exact X account.
              </p>
              {personalXDiffers && (
                <p className="mt-1 text-xs text-muted-foreground/80">
                  Your personal <span className="text-foreground/90">@{connectedXUsername}</span>{" "}
                  is linked for sign-in only — it doesn&apos;t have to match the
                  project handle above.
                </p>
              )}
              <FieldError errors={state.fieldErrors?.xHandle} />
            </div>

            {/* Discord */}
            <div className="rounded-2xl border border-border bg-ink-black/30 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-scarlet-soft" />
                  <p className="text-sm font-medium text-white">Discord server</p>
                </div>
                <ConnectionBadge
                  connection={discordConnection}
                  oauthLive={discordOauthLive}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="discordInvite">Server invite link</Label>
                  <Input
                    id="discordInvite"
                    name="discordInvite"
                    type="url"
                    defaultValue={team.discordInvite ?? ""}
                    placeholder="https://discord.gg/…"
                  />
                  <FieldError errors={state.fieldErrors?.discordInvite} />
                </div>
                <div>
                  <Label htmlFor="discordGuildId">Server (guild) ID</Label>
                  <Input
                    id="discordGuildId"
                    name="discordGuildId"
                    defaultValue={team.discordGuildId ?? ""}
                    placeholder="123456789012345678"
                  />
                  <FieldError errors={state.fieldErrors?.discordGuildId} />
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-border/70 bg-card/40 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-foreground/90">
                  <ShieldCheck className="h-3.5 w-3.5 text-scarlet-soft" />
                  Invite the oxbot Discord bot to your server
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Required for role verification, checking member presence, and
                  automatically assigning winner roles. After inviting, paste the
                  server ID above.
                </p>
                {discordBotInviteUrl ? (
                  <a
                    href={discordBotInviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-scarlet-soft hover:text-white"
                  >
                    Invite oxbot to Discord <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground/80">
                    The oxbot Discord bot isn&apos;t configured in this environment yet.
                  </p>
                )}
              </div>

              <div className="mt-3">
                <Label htmlFor="discordWebhookUrl">Announcement webhook (optional)</Label>
                <Input
                  id="discordWebhookUrl"
                  name="discordWebhookUrl"
                  type="url"
                  defaultValue={team.discordWebhookUrl ?? ""}
                  placeholder="https://discord.com/api/webhooks/…"
                />
                <FieldError errors={state.fieldErrors?.discordWebhookUrl} />
                <p className="mt-1 text-xs text-muted-foreground">
                  When set, every giveaway you publish is announced to this
                  channel automatically. In Discord: Server Settings →
                  Integrations → Webhooks → New Webhook → Copy Webhook URL.
                  No bot invite needed for this one.
                </p>
              </div>
            </div>

            {/* Telegram */}
            <div className="rounded-2xl border border-border bg-ink-black/30 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Send className="h-4 w-4 text-scarlet-soft" />
                <p className="text-sm font-medium text-white">Telegram group</p>
              </div>
              <Label htmlFor="telegram">Group invite link</Label>
              <Input
                id="telegram"
                name="telegram"
                defaultValue={team.telegram ?? ""}
                placeholder="t.me/…"
              />
              <FieldError errors={state.fieldErrors?.telegram} />
            </div>
          </div>
        </Section>

        {/* --- Blockchain & mint details --- */}
        <Section
          title="Blockchain & mint details"
          description="Where your collection or token lives, and launch info shown to entrants."
        >
          <div className="space-y-5">
            <div>
              <Label>Supported chains</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Every network your project operates on.
              </p>
              <div className="flex flex-wrap gap-2">
                {ALL_CHAINS.map((chain) => {
                  const active = chains.has(chain);
                  return (
                    <button
                      key={chain}
                      type="button"
                      onClick={() => toggleChain(chain)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                        active
                          ? "border-primary/60 bg-primary/15 text-white shadow-glow-red"
                          : "border-border bg-card/40 text-muted-foreground hover:border-primary/40 hover:text-white"
                      )}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: CHAIN_META[chain].color }}
                      />
                      {CHAIN_META[chain].label}
                    </button>
                  );
                })}
              </div>
              {[...chains].map((c) => (
                <input key={c} type="hidden" name="chains" value={c} />
              ))}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label>Primary blockchain network</Label>
                <Select
                  value={primaryChain}
                  onValueChange={(v) => setPrimaryChain(v as Blockchain)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a network" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_CHAINS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CHAIN_META[c].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="primaryChain" value={primaryChain} />
                <FieldError errors={state.fieldErrors?.primaryChain} />
              </div>

              <div>
                <Label htmlFor="totalSupply">Total supply</Label>
                <Input
                  id="totalSupply"
                  name="totalSupply"
                  defaultValue={team.totalSupply ?? ""}
                  placeholder="10,000 or TBD"
                  maxLength={40}
                />
                <FieldError errors={state.fieldErrors?.totalSupply} />
              </div>

              <div>
                <Label htmlFor="mintPrice">Mint price</Label>
                <Input
                  id="mintPrice"
                  name="mintPrice"
                  defaultValue={team.mintPrice ?? ""}
                  placeholder="0.08 ETH or Free"
                  maxLength={40}
                />
                <FieldError errors={state.fieldErrors?.mintPrice} />
              </div>

              <div>
                <Label htmlFor="mintAt" className="flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Mint date &amp; time
                </Label>
                <Input
                  id="mintAt"
                  name="mintAt"
                  type="datetime-local"
                  value={mintAt}
                  onChange={(e) => setMintAt(e.target.value)}
                  disabled={mintTba}
                />
                <FieldError errors={state.fieldErrors?.mintAt} />
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card/40 p-4">
              <div>
                <p className="text-sm font-medium text-white">Mint date is TBA</p>
                <p className="text-xs text-muted-foreground">
                  Show &quot;to be announced&quot; instead of a specific date.
                </p>
              </div>
              <Switch
                checked={mintTba}
                onCheckedChange={setMintTba}
                aria-label="Mint date is TBA"
              />
              <input type="hidden" name="mintTba" value={mintTba ? "true" : "false"} />
            </div>
          </div>
        </Section>

        <div className="flex justify-end">
          <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
        </div>
      </form>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 border-t border-border/60 pt-6 first:border-t-0 first:pt-0">
      <div>
        <h3 className="font-display text-sm font-semibold text-white">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

/**
 * Verification badge for the project's public X handle. Unlike the generic
 * connection badge (which reflects the admin's own OAuth login), this is tied
 * to the handle typed into the field — so it can never claim a project handle
 * is "verified as" some unrelated personal account.
 */
function XHandleBadge({
  handle,
  verified,
  oauthLive,
}: {
  handle: string;
  verified: boolean;
  oauthLive: boolean;
}) {
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        Verified as @{handle}
      </span>
    );
  }
  if (handle) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
        @{handle} · unverified
      </span>
    );
  }
  if (!oauthLive) {
    return <span className="text-[11px] text-muted-foreground/70">OAuth not configured</span>;
  }
  return <span className="text-[11px] text-muted-foreground">Not set</span>;
}

function ConnectionBadge({
  connection,
  oauthLive,
}: {
  connection: ConnectionSummary;
  oauthLive: boolean;
}) {
  if (connection) {
    // Prefer the true @handle; fall back to the provider display name.
    const name = connection.username
      ? `@${connection.username}`
      : connection.displayName;
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        {name ? `Verified as ${name}` : "Verified"}
      </span>
    );
  }
  if (!oauthLive) {
    return (
      <span className="text-[11px] text-muted-foreground/70">OAuth not configured</span>
    );
  }
  return <span className="text-[11px] text-muted-foreground">Not connected</span>;
}

/** A self-contained OAuth account-linking button (its own form). */
function ConnectButton({
  provider,
  label,
  callbackUrl,
}: {
  provider: "twitter" | "discord";
  label: string;
  callbackUrl: string;
}) {
  return (
    <form action={oauthSignInAction}>
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <Button type="submit" variant="outline" size="sm">
        {label}
      </Button>
    </form>
  );
}

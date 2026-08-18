"use client";

import { useActionState, useMemo } from "react";
import Link from "next/link";
import type { GiveawayType, RequirementType } from "@prisma/client";
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
  CheckCircle2,
  XCircle,
  Circle,
  Loader2,
  ExternalLink,
  LogIn,
  Trophy,
  PartyPopper,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { submitEntryAction, type EntryResult } from "@/server/actions/entry";
import { oauthSignInAction } from "@/server/actions/auth";
import type { ActionState } from "@/server/actions/_result";
import type { PublicRequirement, ViewerEntry } from "@/server/queries/public-giveaway";
import type { GiveawayPhase } from "@/lib/format";
import { REQUIREMENT_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FormMessage, FieldError } from "@/components/dashboard/form-message";

/**
 * EntryWizard — the participant-facing task checklist + entry form.
 *
 * Renders every requirement as a task row (with live status once submitted),
 * collects the small set of user inputs (code / email / wallet), and posts to
 * `submitEntryAction`. Social + CAPTCHA tasks are verified server-side; in dev
 * mock mode they auto-pass, so the whole flow works with zero external keys.
 *
 * Account-linking prompts (Connect X / Discord) live in their OWN forms ABOVE
 * the entry form — HTML forbids nested forms, so we never embed them inside it.
 */

const REQ_ICONS: Record<RequirementType, LucideIcon> = {
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

const SUBMIT_LABEL: Record<GiveawayType, string> = {
  RANDOM: "Enter giveaway",
  FCFS: "Claim my spot",
  CODE: "Redeem & enter",
};

export type EntryWizardProps = {
  giveawayId: string;
  slug: string;
  type: GiveawayType;
  phase: GiveawayPhase;
  isSignedIn: boolean;
  hasAccountEmail: boolean;
  /** Whether the viewer has saved a wallet on their profile (for the prize nudge). */
  hasProfileWallet: boolean;
  twitterConnected: boolean;
  discordConnected: boolean;
  twitterOauthLive: boolean;
  discordOauthLive: boolean;
  requirements: PublicRequirement[];
  viewerEntry: ViewerEntry | null;
  /** Social context used to build "do the task" links. */
  xAccount: string | null;
  discordInvite: string | null;
};

type RowStatus = "ok" | "fail" | "todo";

const initial: ActionState<EntryResult> = { ok: false };

export function EntryWizard(props: EntryWizardProps) {
  const {
    giveawayId,
    slug,
    type,
    phase,
    isSignedIn,
    hasAccountEmail,
    hasProfileWallet,
    twitterConnected,
    discordConnected,
    twitterOauthLive,
    discordOauthLive,
    requirements,
    viewerEntry,
    xAccount,
    discordInvite,
  } = props;

  // Bind the giveaway id + slug so the action matches useActionState's
  // (prevState, formData) contract.
  const action = useMemo(
    () => submitEntryAction.bind(null, giveawayId, slug),
    [giveawayId, slug]
  );
  const [state, formAction, pending] = useActionState(action, initial);

  // Fresh per-requirement results from the latest submission (override stored).
  const submittedById = useMemo(() => {
    const m = new Map<string, { ok: boolean; detail?: string }>();
    for (const s of state.data?.statuses ?? []) m.set(s.requirementId, s);
    return m;
  }, [state.data]);

  function statusFor(req: PublicRequirement): { status: RowStatus; detail?: string } {
    const fresh = submittedById.get(req.id);
    if (fresh) return { status: fresh.ok ? "ok" : "fail", detail: fresh.detail };
    if (req.viewerStatus === "COMPLETED") return { status: "ok" };
    if (req.viewerStatus === "FAILED") return { status: "fail" };
    return { status: "todo" };
  }

  const alreadyEntered =
    viewerEntry?.status === "COMPLETED" || state.data?.completed === true;

  const requiredReqs = requirements.filter((r) => r.required);
  const doneCount = requiredReqs.filter((r) => statusFor(r).status === "ok").length;
  const progress =
    requiredReqs.length === 0 ? 100 : Math.round((doneCount / requiredReqs.length) * 100);

  // Which inputs to render inside the form.
  const types = new Set(requirements.map((r) => r.type));
  const needsCode = types.has("CODE");
  const needsEmail = types.has("EMAIL") && !hasAccountEmail;
  const hasWallet = types.has("WALLET");

  // Nudge signed-in entrants to save a wallet on their profile when this
  // giveaway doesn't collect one at entry — so their prize wallet is on file
  // for the winners export if they win.
  const showWalletNudge = isSignedIn && !hasWallet && !hasProfileWallet;

  // Live-mode account-linking prompts (mock mode auto-verifies, so none needed).
  const needTwitterConnect =
    twitterOauthLive &&
    !twitterConnected &&
    requirements.some((r) => r.type.startsWith("TWITTER_"));
  const needDiscordConnect =
    discordOauthLive &&
    !discordConnected &&
    requirements.some((r) => r.type.startsWith("DISCORD_"));

  // --- Non-live phases: no entry form ---------------------------------------
  // Still surface the task list for an upcoming giveaway so visitors can see
  // (and get ready for) what they'll need to do before entry opens.
  if (phase !== "live") {
    return (
      <Panel>
        <ClosedState phase={phase} viewerEntry={viewerEntry} type={type} />
        {phase === "upcoming" && requirements.length > 0 && (
          <div className="mt-5">
            <TaskPreview requirements={requirements} />
          </div>
        )}
        {showWalletNudge && (phase === "upcoming" || viewerEntry) && (
          <div className="mt-5">
            <WalletNudge slug={slug} />
          </div>
        )}
      </Panel>
    );
  }

  // --- Signed out -----------------------------------------------------------
  if (!isSignedIn) {
    return (
      <Panel>
        <div className="space-y-4 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-crimson-gradient shadow-glow-red">
            <LogIn className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-white">
              Sign in to enter
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a free account to complete the tasks and enter this giveaway.
            </p>
          </div>
          <Button asChild size="lg" className="w-full">
            <Link href={`/signin?callbackUrl=${encodeURIComponent(`/giveaways/${slug}`)}`}>
              Sign in to continue
            </Link>
          </Button>
          <TaskPreview requirements={requirements} />
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      {/* Header + progress */}
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold text-white">
            {alreadyEntered ? "You're entered" : "Complete to enter"}
          </h3>
          <span className="text-xs tabular-nums text-muted-foreground">
            {doneCount}/{requiredReqs.length} done
          </span>
        </div>
        <Progress value={progress} className="mt-3" />
      </div>

      {alreadyEntered && (
        <EnteredBanner type={type} viewerEntry={viewerEntry} completed={state.data?.completed} />
      )}

      {showWalletNudge && <WalletNudge slug={slug} />}

      {/* Account linking prompts (own forms — never nested in the entry form) */}
      {(needTwitterConnect || needDiscordConnect) && (
        <div className="mb-5 space-y-2 rounded-2xl border border-border bg-ink-black/40 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Connect to verify
          </p>
          {needTwitterConnect && (
            <ConnectButton provider="twitter" label="Connect X (Twitter)" slug={slug} />
          )}
          {needDiscordConnect && (
            <ConnectButton provider="discord" label="Connect Discord" slug={slug} />
          )}
        </div>
      )}

      {/* The entry form: task checklist + inputs + submit */}
      <form action={formAction} className="space-y-4">
        <FormMessage state={state} />

        <ul className="space-y-2.5">
          {requirements.map((req) => (
            <TaskRow
              key={req.id}
              req={req}
              {...statusFor(req)}
              xAccount={xAccount}
              discordInvite={discordInvite}
            />
          ))}
          {requirements.length === 0 && (
            <li className="flex items-center gap-3 rounded-xl border border-border bg-ink-black/30 px-4 py-3 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-scarlet-soft" />
              No tasks required — just click enter below.
            </li>
          )}
        </ul>

        {/* User-supplied inputs, only when a requirement needs them */}
        {(needsCode || needsEmail || hasWallet) && (
          <div className="space-y-3 rounded-2xl border border-border bg-ink-black/40 p-4">
            {needsCode && (
              <div>
                <Label htmlFor="code">Access code</Label>
                <Input
                  id="code"
                  name="code"
                  placeholder="e.g. OX-7K3M9Q2P"
                  autoComplete="off"
                  maxLength={64}
                />
                <FieldError errors={state.fieldErrors?.code} />
              </div>
            )}
            {needsEmail && (
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@wallet.eth"
                  autoComplete="email"
                  maxLength={200}
                />
                <FieldError errors={state.fieldErrors?.email} />
              </div>
            )}
            {hasWallet && (
              <div>
                <Label htmlFor="walletAddress">Wallet address</Label>
                <Input
                  id="walletAddress"
                  name="walletAddress"
                  placeholder="0x… or your chain address"
                  autoComplete="off"
                  maxLength={120}
                />
                <FieldError errors={state.fieldErrors?.walletAddress} />
              </div>
            )}
          </div>
        )}

        {/* captchaToken carried as a hidden field. In mock mode it stays empty
            and the server auto-passes; a real widget populates it in production. */}
        {types.has("CAPTCHA") && <input type="hidden" name="captchaToken" value="" />}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trophy className="h-4 w-4" />
          )}
          {pending ? "Submitting…" : alreadyEntered ? "Re-check tasks" : SUBMIT_LABEL[type]}
        </Button>
      </form>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card bg-card-glow p-6 shadow-card">
      {children}
    </div>
  );
}

/**
 * A gentle prompt for signed-in entrants to save a wallet on their profile, so
 * their prize address is on file for the winners export if they win. Shown only
 * when the giveaway doesn't already collect a wallet at entry.
 */
function WalletNudge({ slug }: { slug: string }) {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-gold/30 bg-gold/[0.07] p-4">
      <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
      <div className="min-w-0 text-sm">
        <p className="font-medium text-gold">Add your wallet to your profile</p>
        <p className="mt-0.5 text-muted-foreground">
          If you win, this is where your prize goes. Add it once and it&apos;s on
          file for every giveaway.
        </p>
        <Link
          href="/profile"
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-gold hover:text-white"
        >
          Add your wallet →
        </Link>
      </div>
    </div>
  );
}

/** A single requirement row with status icon, label, and a "do it" link. */
function TaskRow({
  req,
  status,
  detail,
  xAccount,
  discordInvite,
}: {
  req: PublicRequirement;
  status: RowStatus;
  detail?: string;
  xAccount: string | null;
  discordInvite: string | null;
}) {
  const meta = REQUIREMENT_META[req.type];
  const Icon = REQ_ICONS[req.type];
  const link = taskLink(req, xAccount, discordInvite);

  const StatusIcon =
    status === "ok" ? CheckCircle2 : status === "fail" ? XCircle : Circle;
  const statusColor =
    status === "ok"
      ? "text-emerald-400"
      : status === "fail"
        ? "text-destructive"
        : "text-muted-foreground/50";

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
        status === "ok"
          ? "border-emerald-500/25 bg-emerald-500/5"
          : status === "fail"
            ? "border-destructive/30 bg-destructive/5"
            : "border-border bg-ink-black/30"
      )}
    >
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-card/60">
        <Icon className="h-4 w-4 text-scarlet-soft" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white">{taskLabel(req)}</p>
          {!req.required && (
            <Badge variant="muted" className="px-1.5 py-0 text-[10px]">
              optional
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {detail ?? meta.description}
        </p>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-scarlet-soft hover:text-white"
          >
            {taskCta(req.type)} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <StatusIcon className={cn("mt-0.5 h-5 w-5 shrink-0", statusColor)} />
    </li>
  );
}

/** Build a human label from the requirement + its config. */
function taskLabel(req: PublicRequirement): string {
  const c = req.config;
  switch (req.type) {
    case "TWITTER_FOLLOW":
      return c.handle ? `Follow @${c.handle} on X` : "Follow on X";
    case "TWITTER_LIKE":
      return "Like the post on X";
    case "TWITTER_RETWEET":
      return "Repost on X";
    case "DISCORD_MEMBER":
      // Membership can be narrowed to specific roles; say so when it is.
      return c.roleIds?.length
        ? "Join the Discord server with a required role"
        : "Join the Discord server";
    case "DISCORD_ROLE":
      return "Hold the required Discord role";
    default:
      return REQUIREMENT_META[req.type].label;
  }
}

function taskCta(type: RequirementType): string {
  switch (type) {
    case "TWITTER_FOLLOW":
      return "Open profile";
    case "TWITTER_LIKE":
    case "TWITTER_RETWEET":
      return "Open post";
    case "DISCORD_MEMBER":
    case "DISCORD_ROLE":
      return "Open Discord";
    default:
      return "Open";
  }
}

/** External link that helps the user complete a social task, when known. */
function taskLink(
  req: PublicRequirement,
  xAccount: string | null,
  discordInvite: string | null
): string | null {
  const c = req.config;
  switch (req.type) {
    case "TWITTER_FOLLOW": {
      const handle = c.handle ?? xAccount;
      return handle ? `https://x.com/${handle.replace(/^@/, "")}` : null;
    }
    case "TWITTER_LIKE":
    case "TWITTER_RETWEET":
      return c.tweetUrl ?? null;
    case "DISCORD_MEMBER":
    case "DISCORD_ROLE":
      return c.inviteUrl ?? discordInvite ?? null;
    default:
      return null;
  }
}

/** A compact, non-interactive task list shown to signed-out visitors. */
function TaskPreview({ requirements }: { requirements: PublicRequirement[] }) {
  if (requirements.length === 0) return null;
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-ink-black/40 p-4 text-left">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Tasks to complete
      </p>
      <ul className="space-y-1.5">
        {requirements.map((req) => {
          const Icon = REQ_ICONS[req.type];
          return (
            <li key={req.id} className="flex items-center gap-2 text-sm text-foreground/90">
              <Icon className="h-4 w-4 shrink-0 text-scarlet-soft" />
              {taskLabel(req)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Success banner once the viewer has a completed entry. */
function EnteredBanner({
  type,
  viewerEntry,
  completed,
}: {
  type: GiveawayType;
  viewerEntry: ViewerEntry | null;
  completed?: boolean;
}) {
  const isWinner = viewerEntry?.isWinner;
  return (
    <div
      className={cn(
        "mb-5 flex items-start gap-3 rounded-2xl border p-4",
        isWinner
          ? "border-gold/40 bg-gold/10"
          : "border-emerald-500/30 bg-emerald-500/10"
      )}
    >
      {isWinner ? (
        <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
      ) : (
        <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
      )}
      <div className="text-sm">
        {isWinner ? (
          <p className="font-medium text-gold">
            You won{viewerEntry?.winnerRank ? ` — rank #${viewerEntry.winnerRank}` : ""}! 🎉
          </p>
        ) : (
          <p className="font-medium text-emerald-300">Your entry is confirmed.</p>
        )}
        <p className="mt-0.5 text-muted-foreground">
          {type === "FCFS" && viewerEntry?.seq != null
            ? `You claimed position #${viewerEntry.seq}.`
            : completed
              ? "Good luck! Winners will be announced when the giveaway ends."
              : "Good luck!"}
        </p>
      </div>
    </div>
  );
}

/** Message shown when the giveaway isn't currently accepting entries. */
function ClosedState({
  phase,
  viewerEntry,
  type,
}: {
  phase: GiveawayPhase;
  viewerEntry: ViewerEntry | null;
  type: GiveawayType;
}) {
  const entered = viewerEntry?.status === "COMPLETED";
  // FCFS "ended" means every slot was claimed, not that a clock ran out.
  const endedCopy =
    type === "FCFS"
      ? {
          title: "All spots claimed",
          body: "Every slot in this first-come-first-served giveaway has been taken.",
        }
      : {
          title: "Entry has closed",
          body: "The entry window is over. Winners will be announced shortly.",
        };
  const copy: Record<string, { title: string; body: string }> = {
    upcoming: {
      title: "Entry opens soon",
      body: "This giveaway hasn't started yet. Check back when the countdown begins.",
    },
    ended: endedCopy,
    finalized: {
      title: "Winners have been drawn",
      body: "This giveaway is complete. See the winners on this page.",
    },
    draft: { title: "Not available", body: "This giveaway isn't open." },
    cancelled: { title: "Cancelled", body: "This giveaway was cancelled." },
  };
  const c = copy[phase] ?? copy.ended!;
  return (
    <div className="space-y-3 text-center">
      <h3 className="font-display text-lg font-semibold text-white">{c.title}</h3>
      <p className="text-sm text-muted-foreground">{c.body}</p>
      {entered && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {viewerEntry?.isWinner
            ? `You won${viewerEntry?.winnerRank ? ` — rank #${viewerEntry.winnerRank}` : ""}! 🎉`
            : type === "FCFS" && viewerEntry?.seq != null
              ? `You entered at position #${viewerEntry.seq}.`
              : "You entered this giveaway."}
        </div>
      )}
    </div>
  );
}

/** A self-contained OAuth account-linking button (its own form). */
function ConnectButton({
  provider,
  label,
  slug,
}: {
  provider: "twitter" | "discord";
  label: string;
  slug: string;
}) {
  return (
    <form action={oauthSignInAction}>
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="callbackUrl" value={`/giveaways/${slug}`} />
      <Button type="submit" variant="outline" size="sm" className="w-full">
        {label}
      </Button>
    </form>
  );
}

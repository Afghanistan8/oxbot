import {
  Building2,
  Settings,
  Trash2,
  UserPlus,
  UserMinus,
  UserCog,
  UserCheck,
  LogIn,
  Gift,
  Pencil,
  Copy,
  Rocket,
  Square,
  Ban,
  KeyRound,
  Trophy,
  RefreshCw,
  ShieldCheck,
  Activity,
  Layers,
  ListChecks,
  Handshake,
  Zap,
  MessageSquare,
  Hourglass,
  Wallet,
  PackageCheck,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import type { AuditLogEntry } from "@/server/queries/dashboard";
import { cn } from "@/lib/utils";

/**
 * ActivityFeed — human-readable rendering of a team's audit log. Each action
 * type maps to an icon + label; best-effort detail (e.g. how many winners) is
 * pulled from the entry's meta. Presentational only.
 */

type ActionMeta = { label: string; icon: typeof Gift; tone: string };

const ACTION_META: Record<string, ActionMeta> = {
  "team.create": { label: "created the team", icon: Building2, tone: "text-scarlet-soft" },
  "team.update": { label: "updated team settings", icon: Settings, tone: "text-muted-foreground" },
  "team.delete": { label: "deleted the team", icon: Trash2, tone: "text-destructive" },
  "member.invite": { label: "invited a member", icon: UserPlus, tone: "text-scarlet-soft" },
  "member.invite.revoke": { label: "revoked an invite", icon: UserMinus, tone: "text-muted-foreground" },
  "member.join": { label: "joined the team", icon: LogIn, tone: "text-emerald-400" },
  "member.role_change": { label: "changed a member's role", icon: UserCog, tone: "text-muted-foreground" },
  "member.remove": { label: "removed a member", icon: UserMinus, tone: "text-destructive" },
  "giveaway.create": { label: "created a giveaway", icon: Gift, tone: "text-scarlet-soft" },
  "giveaway.update": { label: "edited a giveaway", icon: Pencil, tone: "text-muted-foreground" },
  "giveaway.duplicate": { label: "duplicated a giveaway", icon: Copy, tone: "text-muted-foreground" },
  "giveaway.publish": { label: "published a giveaway", icon: Rocket, tone: "text-emerald-400" },
  "giveaway.end": { label: "ended a giveaway", icon: Square, tone: "text-muted-foreground" },
  "giveaway.cancel": { label: "cancelled a giveaway", icon: Ban, tone: "text-destructive" },
  "codes.generate": { label: "generated entry codes", icon: KeyRound, tone: "text-scarlet-soft" },
  "codes.revoke": { label: "revoked a code", icon: KeyRound, tone: "text-destructive" },
  "winners.draw": { label: "drew winners", icon: Trophy, tone: "text-gold" },
  "winners.reroll": { label: "re-rolled winners", icon: RefreshCw, tone: "text-gold" },
  "winners.finalize": { label: "finalized winners", icon: ShieldCheck, tone: "text-gold" },
  "entry.disqualify": { label: "moderated an entry", icon: UserCheck, tone: "text-muted-foreground" },
  // OxFoxes Collab
  "listing.create": { label: "created a Collab listing", icon: Layers, tone: "text-scarlet-soft" },
  "listing.update": { label: "edited a Collab listing", icon: Pencil, tone: "text-muted-foreground" },
  "listing.publish": { label: "opened a Collab listing", icon: Rocket, tone: "text-emerald-400" },
  "listing.pause": { label: "paused a Collab listing", icon: Square, tone: "text-muted-foreground" },
  "listing.resume": { label: "resumed a Collab listing", icon: Rocket, tone: "text-emerald-400" },
  "listing.close": { label: "closed a Collab listing", icon: Square, tone: "text-muted-foreground" },
  "listing.cancel": { label: "cancelled a Collab listing", icon: Ban, tone: "text-destructive" },
  "listing.raffle_open": { label: "opened a public WL raffle", icon: Gift, tone: "text-scarlet-soft" },
  "criteria_template.save": { label: "saved a criteria template", icon: ListChecks, tone: "text-muted-foreground" },
  "criteria_template.delete": { label: "deleted a criteria template", icon: Trash2, tone: "text-muted-foreground" },
  "request.submit": { label: "filed a whitelist request", icon: Handshake, tone: "text-scarlet-soft" },
  "request.auto_approve": { label: "auto-approved an FCFS request", icon: Zap, tone: "text-emerald-400" },
  "request.approve": { label: "approved a whitelist request", icon: Handshake, tone: "text-emerald-400" },
  "request.reject": { label: "rejected a whitelist request", icon: Ban, tone: "text-destructive" },
  "request.needs_info": { label: "asked a requester for info", icon: MessageSquare, tone: "text-amber-300" },
  "request.waitlist": { label: "waitlisted a request", icon: Hourglass, tone: "text-muted-foreground" },
  "request.reply": { label: "replied to a review", icon: MessageSquare, tone: "text-muted-foreground" },
  "request.cancel": { label: "withdrew a whitelist request", icon: Ban, tone: "text-muted-foreground" },
  "partner_raffle.draw": { label: "drew the partner raffle", icon: Trophy, tone: "text-gold" },
  "allocation.wallets": { label: "submitted delivery wallets", icon: Wallet, tone: "text-scarlet-soft" },
  "allocation.confirm": { label: "confirmed an allocation", icon: ShieldCheck, tone: "text-emerald-400" },
  "allocation.deliver": { label: "delivered an allocation", icon: PackageCheck, tone: "text-emerald-400" },
  "allocation.revoke": { label: "revoked an allocation", icon: Ban, tone: "text-destructive" },
};

const FALLBACK: ActionMeta = {
  label: "performed an action",
  icon: Activity,
  tone: "text-muted-foreground",
};

/** Best-effort human detail from an entry's meta blob (guarded — never throws). */
function detailFor(action: string, meta: Record<string, unknown> | null): string | null {
  if (!meta) return null;
  if (action === "winners.draw" || action === "winners.reroll") {
    const n = meta.winners;
    if (typeof n === "number") return `${n} winner${n === 1 ? "" : "s"}`;
  }
  if (action === "codes.generate") {
    const n = meta.count;
    if (typeof n === "number") return `${n} code${n === 1 ? "" : "s"}`;
  }
  if (action === "member.role_change" && typeof meta.to === "string") {
    return `→ ${meta.to.toLowerCase()}`;
  }
  if (action === "entry.disqualify") {
    return meta.disqualified === false ? "reinstated" : "disqualified";
  }
  return null;
}

export function ActivityFeed({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/30 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <ul className="divide-y divide-border/70">
        {entries.map((e) => {
          const meta = ACTION_META[e.action] ?? FALLBACK;
          const Icon = meta.icon;
          const who = e.actorName ?? e.actorEmail ?? "System";
          const detail = detailFor(e.action, e.meta);
          return (
            <li key={e.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted",
                  meta.tone
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground/90">
                  <span className="font-medium text-white">{who}</span> {meta.label}
                  {detail && <span className="text-muted-foreground"> · {detail}</span>}
                </p>
              </div>
              <time
                dateTime={e.createdAt.toISOString()}
                title={e.createdAt.toLocaleString()}
                className="shrink-0 text-xs text-muted-foreground"
              >
                {formatDistanceToNow(e.createdAt, { addSuffix: true })}
              </time>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

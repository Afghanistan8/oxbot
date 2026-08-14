import { Trophy } from "lucide-react";
import type { EntryStatus, RequirementStatus } from "@prisma/client";

import type { EntrantRow, ManagedRequirement } from "@/server/queries/dashboard";
import { REQUIREMENT_META } from "@/lib/constants";
import { cn, shortenAddress } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { EntrantRowActions } from "./entrant-row-actions";

/**
 * EntrantsTable — the PRIVATE entrant list (server component). Shows full
 * identity (name/email/wallet), the FCFS slot / winner rank, a per-requirement
 * status dot-row, and moderation actions. Only ever rendered on team-gated
 * dashboard pages.
 */

const STATUS_BADGE: Record<EntryStatus, { label: string; variant: BadgeProps["variant"] }> = {
  COMPLETED: { label: "Completed", variant: "success" },
  PENDING: { label: "Pending", variant: "muted" },
  DISQUALIFIED: { label: "Disqualified", variant: "danger" },
};

const REQ_DOT: Record<RequirementStatus, string> = {
  COMPLETED: "bg-emerald-400",
  FAILED: "bg-destructive",
  PENDING: "bg-muted-foreground/40",
};

export function EntrantsTable({
  entrants,
  requirements,
  canManage,
}: {
  entrants: EntrantRow[];
  requirements: ManagedRequirement[];
  canManage: boolean;
}) {
  if (entrants.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 py-12 text-center">
        <p className="text-sm text-muted-foreground">No entrants match this filter yet.</p>
      </div>
    );
  }

  const hasReqs = requirements.length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-16">Slot</TableHead>
            <TableHead>Entrant</TableHead>
            <TableHead>Detail</TableHead>
            {hasReqs && <TableHead>Tasks</TableHead>}
            <TableHead>Status</TableHead>
            {canManage && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entrants.map((e) => {
            const statusByReq = new Map(
              e.requirementStatuses.map((s) => [s.requirementId, s.status])
            );
            const badge = STATUS_BADGE[e.status];
            return (
              <TableRow key={e.entryId}>
                <TableCell className="tabular-nums text-muted-foreground">
                  {e.isWinner && e.winnerRank !== null ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-gold">
                      <Trophy className="h-3.5 w-3.5" />
                      {e.winnerRank}
                    </span>
                  ) : e.seq !== null ? (
                    `#${e.seq}`
                  ) : (
                    "—"
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8">
                      {e.image && <AvatarImage src={e.image} alt="" />}
                      <AvatarFallback>{initials(e.name, e.email)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {e.name ?? "Anonymous"}
                      </p>
                      {e.email && (
                        <p className="truncate text-xs text-muted-foreground">{e.email}</p>
                      )}
                    </div>
                  </div>
                </TableCell>

                <TableCell className="text-xs text-muted-foreground">
                  {e.code ? (
                    <span className="font-mono text-scarlet-soft">{e.code}</span>
                  ) : e.wallet ? (
                    <span className="font-mono" title={e.wallet}>
                      {shortenAddress(e.wallet)}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>

                {hasReqs && (
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {requirements.map((r) => {
                        const st: RequirementStatus = statusByReq.get(r.id) ?? "PENDING";
                        return (
                          <span
                            key={r.id}
                            title={`${REQUIREMENT_META[r.type].short}: ${st.toLowerCase()}`}
                            className={cn("h-2 w-2 rounded-full", REQ_DOT[st])}
                          />
                        );
                      })}
                    </div>
                  </TableCell>
                )}

                <TableCell>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </TableCell>

                {canManage && (
                  <TableCell className="text-right">
                    <EntrantRowActions
                      entryId={e.entryId}
                      disqualified={e.status === "DISQUALIFIED"}
                    />
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {hasReqs && (
        <div className="flex flex-wrap items-center gap-4 border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Completed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-destructive" /> Failed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40" /> Pending
          </span>
          <span className="ml-auto">Hover a dot for the task name</span>
        </div>
      )}
    </div>
  );
}

function initials(name: string | null, email: string | null): string {
  const src = name ?? email ?? "?";
  const parts = src.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import type { IncomingRequestRow } from "@/server/queries/collab";
import { REQUEST_STATUS_META } from "@/lib/collab/constants";
import { cn, formatNumber } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/local-time";

/**
 * RequestsTable — the PRIVATE incoming queue (server component), in the
 * entrants-table idiom: requester, listing, ask, eligibility score, stats,
 * status. Rows link into the review page.
 */
const compact = (n: number | null) =>
  n === null ? "—" : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export function RequestsTable({ requests, teamSlug }: { requests: IncomingRequestRow[]; teamSlug: string }) {
  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 py-12 text-center">
        <p className="text-sm text-muted-foreground">No requests match this filter.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Requester</TableHead>
            <TableHead className="hidden md:table-cell">Listing</TableHead>
            <TableHead className="text-right">Asked</TableHead>
            <TableHead>Score</TableHead>
            <TableHead className="hidden lg:table-cell">Community · X · Discord</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((r) => {
            const meta = REQUEST_STATUS_META[r.status];
            const href = `/dashboard/${teamSlug}/collab/requests/${r.id}`;
            return (
              <TableRow key={r.id} className="cursor-pointer">
                <TableCell>
                  <Link href={href} className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8">
                      {r.requesterTeam.logoUrl && <AvatarImage src={r.requesterTeam.logoUrl} alt="" />}
                      <AvatarFallback>{r.requesterTeam.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {r.communityName && r.communityName !== r.requesterTeam.name ? r.communityName : r.requesterTeam.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        <LocalTime value={r.createdAt} mode="date" />
                        {r.requesterTeam.xHandle && <> · @{r.requesterTeam.xHandle}</>}
                      </p>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="hidden max-w-[14rem] md:table-cell">
                  <Link href={href} className="block truncate text-sm text-foreground/85">
                    {r.listing.title}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <Link href={href} className="text-sm text-white">
                    {r.spotsGranted !== null ? (
                      <>
                        <span className="text-emerald-300">{formatNumber(r.spotsGranted)}</span>
                        <span className="text-muted-foreground">/{formatNumber(r.spotsRequested)}</span>
                      </>
                    ) : (
                      formatNumber(r.spotsRequested)
                    )}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={href} className="flex items-center gap-2">
                    <span className="relative h-1.5 w-14 overflow-hidden rounded-full bg-ink-black/60">
                      <span
                        className={cn("absolute inset-y-0 left-0 rounded-full", r.eligible ? "bg-emerald-400" : "bg-amber-400")}
                        style={{ width: `${r.eligibilityScore}%` }}
                      />
                    </span>
                    <span className={cn("text-xs tabular-nums", r.eligible ? "text-emerald-300" : "text-amber-300")}>
                      {r.eligibilityScore}
                    </span>
                    {!r.eligible && <AlertTriangle className="h-3.5 w-3.5 text-amber-300" aria-label="Below criteria" />}
                  </Link>
                </TableCell>
                <TableCell className="hidden text-xs tabular-nums text-muted-foreground lg:table-cell">
                  {compact(r.communitySize)} · {compact(r.twitterFollowers)} · {compact(r.discordMembers)}
                </TableCell>
                <TableCell>
                  <Badge variant={meta.badge}>{meta.label}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

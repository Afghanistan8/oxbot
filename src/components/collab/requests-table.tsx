import Link from "next/link";
import { UserCog } from "lucide-react";

import type { IncomingRequestRow } from "@/server/queries/collab";
import { REQUEST_STATUS_META } from "@/lib/collab/constants";
import { formatNumber } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/local-time";

/**
 * RequestsTable — the PRIVATE incoming queue (server component), in the
 * entrants-table idiom: requester, listing, ask, community size, status.
 * Rows link into the review page.
 */
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
            <TableHead className="hidden lg:table-cell text-right">Community size</TableHead>
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
                      {r.requesterTeam?.logoUrl && <AvatarImage src={r.requesterTeam.logoUrl} alt="" />}
                      <AvatarFallback>{r.communityName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{r.communityName}</p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <LocalTime value={r.createdAt} mode="date" />
                        {r.requesterTeam ? (
                          <> · {r.requesterTeam.name}</>
                        ) : r.addedByAdmin ? (
                          <span className="inline-flex items-center gap-1">
                            · <UserCog className="h-3 w-3" /> Added by admin
                          </span>
                        ) : null}
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
                <TableCell className="hidden text-right text-xs tabular-nums text-muted-foreground lg:table-cell">
                  {formatNumber(r.communitySize)}
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

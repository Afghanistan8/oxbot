import { Fragment } from "react";
import { Download, Package } from "lucide-react";

import { resolveTeamPage } from "@/server/queries/require-team-page";
import { getTeamAllocations } from "@/server/queries/collab";
import { ALLOCATION_STATUS_META } from "@/lib/collab/constants";
import { CHAIN_META, roleAtLeast } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AllocationRowActions } from "@/components/collab/allocation-row-actions";
import { AllocationWalletsForm } from "@/components/collab/outgoing-actions";
import { CollabEmptyState } from "@/components/collab/collab-empty-state";

export const metadata = { title: "Allocations" };

/** Every spot this team has granted to partners, with delivery status + CSV export. */
export default async function AllocationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ team: string }>;
  searchParams: Promise<{ listing?: string }>;
}) {
  const [{ team: slug }, sp] = await Promise.all([params, searchParams]);
  const { team, membership } = await resolveTeamPage(slug, "COLLAB_MANAGER");
  const allocations = await getTeamAllocations(team.id, sp.listing || undefined);
  const live = allocations.filter((a) => a.status !== "REVOKED");
  const totals = {
    spots: live.reduce((n, a) => n + a.spots, 0),
    wallets: live.reduce((n, a) => n + a.wallets.length, 0),
    delivered: live.filter((a) => a.status === "DELIVERED").reduce((n, a) => n + a.spots, 0),
  };
  const canRevoke = roleAtLeast(membership.role, "ADMIN");

  return (
    <>
      <PageHeader title="Allocations" description="Spots granted to partners, and where delivery stands.">
        {allocations.length > 0 && (
          <Button asChild size="sm">
            <a href={`/dashboard/${slug}/collab/allocations/export${sp.listing ? `?listing=${sp.listing}` : ""}`}>
              <Download className="h-4 w-4" />
              Export CSV
            </a>
          </Button>
        )}
      </PageHeader>

      {allocations.length === 0 ? (
        <CollabEmptyState
          icon={Package}
          title="No allocations yet"
          body="Approved requests show up here with their delivery wallets, ready to export."
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            <Mini label="Spots granted" value={formatNumber(totals.spots)} />
            <Mini label="Wallets received" value={formatNumber(totals.wallets)} />
            <Mini label="Delivered" value={formatNumber(totals.delivered)} />
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Partner</TableHead>
                  <TableHead className="hidden md:table-cell">Listing</TableHead>
                  <TableHead className="text-right">Spots</TableHead>
                  <TableHead className="text-right">Wallets</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations.map((a) => {
                  const meta = ALLOCATION_STATUS_META[a.status];
                  // A teamless (admin-added) allocation has no receiving team to log in
                  // and paste wallets from their own desk — offer that here instead.
                  const needsWalletsFromUs = !a.team && a.status !== "REVOKED" && a.status !== "DELIVERED";
                  return (
                    <Fragment key={a.id}>
                      <TableRow>
                        <TableCell>
                          <p className="text-sm font-medium text-white">{a.team?.name ?? a.request?.communityName ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            Granted <LocalTime value={a.createdAt} mode="date" />
                            {a.team?.xHandle && <> · @{a.team.xHandle}</>}
                          </p>
                        </TableCell>
                        <TableCell className="hidden max-w-[14rem] truncate text-sm text-foreground/85 md:table-cell">
                          {a.listing.title}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-white">{formatNumber(a.spots)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {a.wallets.length}/{a.spots}
                        </TableCell>
                        <TableCell>
                          <Badge variant={meta.badge}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <AllocationRowActions allocationId={a.id} status={a.status} canRevoke={canRevoke} />
                        </TableCell>
                      </TableRow>
                      {needsWalletsFromUs && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={6} className="bg-ink-black/30">
                            <p className="mb-2 text-xs text-muted-foreground">
                              No oxbot account on the receiving end — paste their delivery wallets yourself.
                            </p>
                            <AllocationWalletsForm
                              allocationId={a.id}
                              spots={a.spots}
                              existing={a.wallets.map((w) => (w.label ? `${w.address}, ${w.label}` : w.address)).join("\n")}
                              chainLabel={CHAIN_META[a.listing.chain].label}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card bg-card-glow p-4 shadow-card">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}

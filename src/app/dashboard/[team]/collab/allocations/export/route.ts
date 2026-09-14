import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/session";
import { requireTeamBySlug, AuthzError } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { buildCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";
import { CHAIN_META } from "@/lib/constants";
import { getTeamAllocations } from "@/server/queries/collab";

/**
 * PRIVATE allocations CSV — team-only (EDITOR+), same authorization pattern as
 * the giveaway exports. One row per delivery wallet (or one row per allocation
 * with no wallets yet), so the file drops straight into a whitelist tool.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ team: string }> }) {
  const { team: slug } = await params;
  const listingId = new URL(req.url).searchParams.get("listing") || undefined;

  const userId = await getCurrentUserId();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  if (!rateLimit(`collab-export:${userId}`, 20, 60_000).success) {
    return new NextResponse("Too many exports — slow down.", { status: 429 });
  }

  try {
    const { team } = await requireTeamBySlug(userId, slug, "EDITOR");
    const allocations = await getTeamAllocations(team.id, listingId);

    const header = [
      "Team",
      "Community",
      "Listing",
      "Spots",
      "Status",
      "Wallet",
      "Wallet Chain",
      "Wallet Label",
      "Contact Name",
      "Contact Method",
      "Contact Handle",
      "Team X",
      "Team Discord",
      "Granted At",
      "Confirmed At",
      "Delivered At",
    ];
    const rows = allocations.flatMap((a) => {
      const base = (wallet: { address: string; chain: string; label: string } | null) => [
        a.team?.name ?? "",
        a.request?.communityName ?? "",
        a.listing.title,
        a.spots,
        a.status,
        wallet?.address ?? "",
        wallet ? (CHAIN_META[wallet.chain as keyof typeof CHAIN_META]?.label ?? wallet.chain) : "",
        wallet?.label ?? "",
        a.request?.contactName ?? "",
        a.request?.contactMethod ?? "",
        a.request?.contactHandle ?? "",
        a.team?.xHandle ? `@${a.team.xHandle}` : "",
        a.team?.discordInvite ?? "",
        formatDateTime(a.createdAt, "UTC"),
        a.confirmedAt ? formatDateTime(a.confirmedAt, "UTC") : "",
        a.deliveredAt ? formatDateTime(a.deliveredAt, "UTC") : "",
      ];
      return a.wallets.length ? a.wallets.map((w) => base(w)) : [base(null)];
    });

    await recordAudit({
      teamId: team.id,
      actorId: userId,
      action: "allocation.export",
      target: listingId ?? null,
      meta: { allocations: allocations.length, rows: rows.length },
    });

    return new NextResponse(buildCsv(header, rows), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${team.slug}-collab-allocations.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AuthzError) {
      const notFound = err.code === "NOT_FOUND";
      return new NextResponse(notFound ? "Not found" : "Forbidden", { status: notFound ? 404 : 403 });
    }
    throw err;
  }
}

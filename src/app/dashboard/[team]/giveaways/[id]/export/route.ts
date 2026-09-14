import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/session";
import { requireTeamBySlug, AuthzError } from "@/lib/authz";
import {
  getManagedGiveaway,
  getGiveawayEntrants,
  type EntrantRow,
  type ManagedRequirement,
} from "@/server/queries/dashboard";
import { REQUIREMENT_META } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { buildCsv } from "@/lib/csv";

/**
 * Private entrant CSV export — team-only.
 *
 * Gated by team membership (EDITOR+). Streams the full entrant list with one
 * column per requirement. This is the ONLY way entrant data leaves the server,
 * and it never touches a public route.
 */
export const dynamic = "force-dynamic";

function buildEntrantsCsv(requirements: ManagedRequirement[], rows: EntrantRow[]): string {
  const header = [
    "Rank",
    "Seq",
    "Name",
    "Email",
    "Wallet",
    "Code",
    "Status",
    "Winner",
    "Submitted",
    ...requirements.map((r) => REQUIREMENT_META[r.type].short + (r.required ? "" : " (optional)")),
  ];

  const csvRows = rows.map((e) => {
    const statusByReq = new Map(e.requirementStatuses.map((s) => [s.requirementId, s.status]));
    return [
      e.winnerRank ?? "",
      e.seq ?? "",
      e.name ?? "",
      e.email ?? "",
      e.wallet ?? "",
      e.code ?? "",
      e.status,
      e.isWinner ? "yes" : "",
      e.submittedAt ? formatDateTime(e.submittedAt) : "",
      ...requirements.map((r) => statusByReq.get(r.id) ?? ""),
    ];
  });

  return buildCsv(header, csvRows);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ team: string; id: string }> }
) {
  const { team: slug, id } = await params;

  const userId = await getCurrentUserId();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const { team } = await requireTeamBySlug(userId, slug, "EDITOR");
    const giveaway = await getManagedGiveaway(team.id, id);
    if (!giveaway) return new NextResponse("Not found", { status: 404 });

    const entrants = await getGiveawayEntrants(id);
    const csv = buildEntrantsCsv(giveaway.requirements, entrants);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${giveaway.slug}-entrants.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof AuthzError) {
      const notFound = err.code === "NOT_FOUND";
      return new NextResponse(notFound ? "Not found" : "Forbidden", {
        status: notFound ? 404 : 403,
      });
    }
    throw err;
  }
}

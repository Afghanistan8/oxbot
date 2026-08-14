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

/**
 * Private entrant CSV export — team-only.
 *
 * Gated by team membership (EDITOR+). Streams the full entrant list with one
 * column per requirement. This is the ONLY way entrant data leaves the server,
 * and it never touches a public route.
 */
export const dynamic = "force-dynamic";

/** Escape a value for a CSV cell + neutralize spreadsheet formula injection. */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Fields like names come from user-controlled OAuth profiles; a leading
  // =/+/-/@ could be executed as a formula by Excel/Sheets. Prefix with a quote.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(requirements: ManagedRequirement[], rows: EntrantRow[]): string {
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

  const lines = [header.map(csvCell).join(",")];

  for (const e of rows) {
    const statusByReq = new Map(e.requirementStatuses.map((s) => [s.requirementId, s.status]));
    const row = [
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
    lines.push(row.map(csvCell).join(","));
  }

  // CRLF line endings for maximum spreadsheet compatibility.
  return lines.join("\r\n") + "\r\n";
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
    const csv = buildCsv(giveaway.requirements, entrants);

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

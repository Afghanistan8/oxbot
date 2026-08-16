import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/session";
import { requireTeamBySlug, AuthzError } from "@/lib/authz";
import { getManagedGiveaway, getWinnerExportRows, type WinnerExportRow } from "@/server/queries/dashboard";
import { formatDateTime } from "@/lib/format";
import { buildCsv } from "@/lib/csv";

/**
 * Private winners-only CSV export — team-only (EDITOR+), same authorization
 * pattern as the full entrants export. A CSV opens directly in Google
 * Sheets (drag-and-drop, or File > Import), so this doubles as "download
 * winners into a spreadsheet" without a live Sheets API integration.
 */
export const dynamic = "force-dynamic";

function buildWinnersCsv(rows: WinnerExportRow[]): string {
  const header = ["Rank", "Name", "Email", "Discord Username", "Wallet Address", "Entered At", "FCFS Slot"];
  const csvRows = rows.map((w) => [
    w.rank,
    w.name ?? "",
    w.email ?? "",
    w.discordUsername ? `@${w.discordUsername}` : "",
    w.wallet ?? "",
    w.enteredAt ? formatDateTime(w.enteredAt) : "",
    w.seq ?? "",
  ]);
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

    const winners = await getWinnerExportRows(id);
    const csv = buildWinnersCsv(winners);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${giveaway.slug}-winners.csv"`,
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

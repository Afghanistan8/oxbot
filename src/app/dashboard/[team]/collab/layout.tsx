import { db } from "@/lib/db";
import { OPEN_REQUEST_STATUSES } from "@/lib/collab/constants";
import { resolveTeamPage } from "@/server/queries/require-team-page";
import { CollabSubnav } from "@/components/collab/collab-subnav";

/**
 * Shared shell for `/dashboard/[team]/collab/**` — gates on membership and
 * renders the Collab section tabs with live to-do counts.
 */
export default async function TeamCollabLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ team: string }>;
}) {
  const { team: slug } = await params;
  const { team } = await resolveTeamPage(slug, "COLLAB_MANAGER");

  const [incoming, outgoing] = await Promise.all([
    db.collabRequest.count({ where: { listing: { teamId: team.id }, status: { in: OPEN_REQUEST_STATUSES } } }),
    db.collabRequest.count({ where: { requesterTeamId: team.id, status: "NEEDS_INFO" } }),
  ]);

  return (
    <>
      <CollabSubnav counts={{ incoming, outgoing }} />
      {children}
    </>
  );
}

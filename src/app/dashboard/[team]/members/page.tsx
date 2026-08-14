import { resolveTeamViewer } from "@/server/queries/require-team-page";
import { getTeamDetail } from "@/server/queries/teams";
import { roleAtLeast } from "@/lib/constants";
import { PageHeader } from "@/components/dashboard/page-header";
import { InviteMemberForm } from "@/components/dashboard/invite-member-form";
import { MembersManager } from "@/components/dashboard/members-manager";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const metadata = { title: "Members" };

/**
 * Members page — list members with role controls + pending invites. Any member
 * can view; only ADMIN/OWNER see management controls (enforced server-side too).
 */
export default async function MembersPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team: slug } = await params;
  const { team, membership, userId } = await resolveTeamViewer(slug);
  const detail = await getTeamDetail(slug);

  // resolveTeamViewer already 404s on missing team; detail is guaranteed here.
  const members =
    detail?.members.map((m) => ({
      id: m.id,
      role: m.role,
      user: {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
      },
    })) ?? [];

  const invites =
    detail?.invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      token: i.token,
      expiresAt: i.expiresAt.toISOString(),
    })) ?? [];

  const canManage = roleAtLeast(membership.role, "ADMIN");

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Members"
        description="Invite teammates and manage their access."
      />

      {canManage && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Invite a teammate</CardTitle>
            <CardDescription>
              Admins manage members &amp; settings. Raffle Managers can run
              giveaways on the project&apos;s behalf without full admin access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteMemberForm teamId={team.id} />
          </CardContent>
        </Card>
      )}

      <MembersManager
        teamId={team.id}
        members={members}
        invites={invites}
        viewerRole={membership.role}
        viewerUserId={userId}
      />
    </div>
  );
}

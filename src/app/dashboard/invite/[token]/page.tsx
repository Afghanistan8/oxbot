import Link from "next/link";
import { Mail, AlertTriangle } from "lucide-react";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ROLE_META } from "@/lib/constants";
import { AcceptInvite } from "@/components/dashboard/accept-invite";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Accept invite" };

/**
 * Invite acceptance page. Shows the project + role, validates the token state,
 * and offers to join. Actual membership creation happens in the server action
 * (which re-checks token validity + that the signed-in email matches).
 */
export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await requireUser(`/dashboard/invite/${token}`);

  const invite = await db.teamInvite.findUnique({
    where: { token },
    include: { team: { select: { name: true, slug: true, logoUrl: true } } },
  });

  const invalid = !invite || invite.acceptedAt !== null;
  const expired = invite ? invite.expiresAt < new Date() : false;
  const emailMismatch =
    invite && user.email
      ? user.email.toLowerCase() !== invite.email.toLowerCase()
      : Boolean(invite);

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader className="items-center text-center">
          <div className="mb-2 grid h-14 w-14 place-items-center overflow-hidden rounded-2xl bg-crimson-gradient shadow-glow-red">
            {invite?.team.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={invite.team.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Mail className="h-6 w-6 text-white" />
            )}
          </div>
          <CardTitle>
            {invalid
              ? "Invite unavailable"
              : `Join ${invite?.team.name}`}
          </CardTitle>
          <CardDescription>
            {invalid
              ? "This invite is invalid or has already been used."
              : `You've been invited as ${ROLE_META[invite!.role].label}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invalid ? (
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          ) : expired ? (
            <Notice>
              This invite has expired. Ask an admin to send a new one.
            </Notice>
          ) : emailMismatch ? (
            <Notice>
              This invite was sent to <strong>{invite!.email}</strong>, but
              you&apos;re signed in as{" "}
              <strong>{user.email ?? "another account"}</strong>. Sign in with the
              invited email to accept.
            </Notice>
          ) : (
            <AcceptInvite token={token} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

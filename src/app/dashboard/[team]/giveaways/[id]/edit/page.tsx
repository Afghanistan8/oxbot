import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { resolveTeamPage } from "@/server/queries/require-team-page";
import { getManagedGiveaway } from "@/server/queries/dashboard";
import { PageHeader } from "@/components/dashboard/page-header";
import { GiveawayForm } from "@/components/dashboard/giveaway-form";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Edit giveaway" };

/**
 * Edit-giveaway page. EDITOR+ only. Requirements are locked in the form once
 * entries exist (also enforced server-side).
 */
export default async function EditGiveawayPage({
  params,
}: {
  params: Promise<{ team: string; id: string }>;
}) {
  const { team: slug, id } = await params;
  const { team } = await resolveTeamPage(slug, "EDITOR");
  const giveaway = await getManagedGiveaway(team.id, id);
  if (!giveaway) notFound();

  return (
    <div className="max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground">
        <Link href={`/dashboard/${slug}/giveaways/${id}`}>
          <ArrowLeft className="h-4 w-4" />
          Back to giveaway
        </Link>
      </Button>

      <PageHeader title="Edit giveaway" description={giveaway.title} />

      <GiveawayForm mode="edit" teamId={team.id} giveaway={giveaway} />
    </div>
  );
}

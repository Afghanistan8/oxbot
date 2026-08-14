import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { resolveTeamPage } from "@/server/queries/require-team-page";
import { PageHeader } from "@/components/dashboard/page-header";
import { GiveawayForm } from "@/components/dashboard/giveaway-form";
import { Button } from "@/components/ui/button";
import type { Blockchain } from "@prisma/client";

export const metadata = { title: "New giveaway" };

/**
 * Create-giveaway page. EDITOR+ only. Pre-selects the team's first chain.
 */
export default async function NewGiveawayPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team: slug } = await params;
  const { team } = await resolveTeamPage(slug, "EDITOR");
  const defaultChain = (team.chains[0] as Blockchain | undefined) ?? "ETHEREUM";

  return (
    <div className="max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground">
        <Link href={`/dashboard/${slug}/giveaways`}>
          <ArrowLeft className="h-4 w-4" />
          Back to giveaways
        </Link>
      </Button>

      <PageHeader
        title="New giveaway"
        description="Configure the format, schedule, and entry requirements."
      />

      <GiveawayForm mode="create" teamId={team.id} defaultChain={defaultChain} />
    </div>
  );
}

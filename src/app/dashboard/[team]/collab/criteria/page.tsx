import { resolveTeamPage } from "@/server/queries/require-team-page";
import { getCriteriaTemplates } from "@/server/queries/collab";
import { PageHeader } from "@/components/dashboard/page-header";
import { CriteriaTemplateManager } from "@/components/collab/criteria-template-manager";

export const metadata = { title: "Criteria templates" };

/** Saved, reusable qualification rules for new listings. */
export default async function CriteriaTemplatesPage({ params }: { params: Promise<{ team: string }> }) {
  const { team: slug } = await params;
  const { team } = await resolveTeamPage(slug, "EDITOR");
  const templates = await getCriteriaTemplates(team.id);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Criteria templates"
        description="Reusable qualification rules. Apply one when you create a listing."
      />
      <CriteriaTemplateManager teamId={team.id} templates={templates} />
    </div>
  );
}

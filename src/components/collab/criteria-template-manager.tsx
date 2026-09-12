"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ListChecks, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";

import { deleteCriteriaTemplateAction, saveCriteriaTemplateAction } from "@/server/actions/collab";
import type { ActionState } from "@/server/actions/_result";
import type { CriteriaTemplate } from "@/server/queries/collab";
import { summarizeCriteria } from "@/lib/collab/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, FormMessage } from "@/components/dashboard/form-message";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CriteriaEditor, draftFromCriteria, serializeCriteria } from "@/components/collab/criteria-editor";

/**
 * CriteriaTemplateManager — list, create, edit and delete a team's reusable
 * criteria sets. Templates show up as "Apply template" in the listing form.
 */
export function CriteriaTemplateManager({ teamId, templates }: { teamId: string; templates: CriteriaTemplate[] }) {
  const [editing, setEditing] = useState<CriteriaTemplate | "new" | null>(templates.length === 0 ? "new" : null);

  return (
    <div className="space-y-6">
      {editing ? (
        <TemplateEditor
          key={editing === "new" ? "new" : editing.id}
          teamId={teamId}
          template={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
          canCancel={templates.length > 0}
        />
      ) : (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" />
            New template
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {templates.map((t) => (
          <TemplateRow key={t.id} template={t} onEdit={() => setEditing(t)} />
        ))}
      </div>
    </div>
  );
}

function TemplateRow({ template, onEdit }: { template: CriteriaTemplate; onEdit: () => void }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  async function remove() {
    if (!(await confirm({ description: `Delete "${template.name}"? Listings that used it keep their criteria.`, variant: "destructive", confirmLabel: "Delete" }))) {
      return;
    }
    startTransition(async () => {
      const res = await deleteCriteriaTemplateAction(template.id);
      if (res.ok) {
        toast.success(res.message ?? "Deleted.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't delete.");
      }
    });
  }

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card/60 p-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
        <ListChecks className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">{template.name}</p>
        <p className="truncate text-xs text-muted-foreground">{summarizeCriteria(template.criteria)}</p>
      </div>
      <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit template">
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive"
        onClick={remove}
        disabled={pending}
        aria-label="Delete template"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </Button>
    </div>
  );
}

const initial: ActionState = { ok: false };

function TemplateEditor({
  teamId,
  template,
  onDone,
  canCancel,
}: {
  teamId: string;
  template: CriteriaTemplate | null;
  onDone: () => void;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(draftFromCriteria(template?.criteria));
  const [state, formAction, pending] = useActionState(
    saveCriteriaTemplateAction.bind(null, teamId, template?.id ?? null),
    initial
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Saved.");
      router.refresh();
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{template ? "Edit template" : "New criteria template"}</CardTitle>
        {canCancel && (
          <Button variant="ghost" size="icon" onClick={onDone} aria-label="Close editor">
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <input type="hidden" name="criteria" value={serializeCriteria(draft)} />
          <FormMessage state={state.ok ? undefined : state} />
          <div className="max-w-sm">
            <Label htmlFor="template-name">Template name</Label>
            <Input id="template-name" name="name" defaultValue={template?.name ?? ""} placeholder="e.g. Blue-chip DAOs" maxLength={60} required />
            <FieldError errors={state.fieldErrors?.name} />
          </div>
          <CriteriaEditor value={draft} onChange={setDraft} />
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {template ? "Save template" : "Create template"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

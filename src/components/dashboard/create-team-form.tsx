"use client";

import { useActionState, useState } from "react";

import { createTeamAction } from "@/server/actions/team";
import { ActionState } from "@/server/actions/_result";
import { slugify } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/dashboard/submit-button";
import { FormMessage, FieldError } from "@/components/dashboard/form-message";

const initial: ActionState<{ slug: string }> = { ok: false };

/**
 * CreateTeamForm — collects a project name + mandatory URL slug + optional
 * description. The slug auto-fills from the name until the user edits it
 * directly. On success the action redirects to the new project.
 */
export function CreateTeamForm() {
  const [state, formAction] = useActionState(createTeamAction, initial);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
      <FormMessage state={state} />

      <div>
        <Label htmlFor="name">Project name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Ember Labs"
          required
          maxLength={60}
          autoFocus
          onChange={(e) => {
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
        />
        <FieldError errors={state.fieldErrors?.name} />
      </div>

      <div>
        <Label htmlFor="slug">URL slug</Label>
        <div className="flex items-center">
          <span className="inline-flex h-10 items-center rounded-l-xl border border-r-0 border-input bg-ink-black/60 px-3 text-sm text-muted-foreground">
            /dashboard/
          </span>
          <Input
            id="slug"
            name="slug"
            placeholder="ember-labs"
            className="rounded-l-none"
            maxLength={48}
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Your project&apos;s permanent URL. Lowercase letters, numbers, and dashes only.
        </p>
        <FieldError errors={state.fieldErrors?.slug} />
      </div>

      <div>
        <Label htmlFor="description">
          Description <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="description"
          name="description"
          placeholder="What does your project do?"
          rows={3}
          maxLength={500}
        />
        <FieldError errors={state.fieldErrors?.description} />
      </div>

      <SubmitButton pendingText="Creating…" className="w-full">
        Create project
      </SubmitButton>
    </form>
  );
}

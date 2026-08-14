"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

import { inviteMemberAction } from "@/server/actions/team";
import { ActionState } from "@/server/actions/_result";
import { ROLE_META } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/dashboard/submit-button";
import { FieldError } from "@/components/dashboard/form-message";

const initial: ActionState = { ok: false };

/**
 * InviteMemberForm — invite a teammate by email + role. Toasts on result and
 * resets the email field on success.
 */
export function InviteMemberForm({ teamId }: { teamId: string }) {
  const action = inviteMemberAction.bind(null, teamId);
  const [state, formAction] = useActionState(action, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      formRef.current?.reset();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Label htmlFor="invite-email">Email address</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          placeholder="teammate@project.xyz"
          required
        />
        <FieldError errors={state.fieldErrors?.email} />
      </div>
      <div className="sm:w-40">
        <Label htmlFor="invite-role">Role</Label>
        <Select name="role" defaultValue="EDITOR">
          <SelectTrigger id="invite-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ADMIN">{ROLE_META.ADMIN.label}</SelectItem>
            <SelectItem value="EDITOR">{ROLE_META.EDITOR.label}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <SubmitButton pendingText="Inviting…">
        <UserPlus className="h-4 w-4" />
        Invite
      </SubmitButton>
    </form>
  );
}

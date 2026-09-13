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
 * InviteMemberForm — add a teammate by their Discord username + role. The person
 * must already have an oxbot account with Discord linked; they're added
 * instantly. Toasts on result and resets the field on success.
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
        <Label htmlFor="invite-discord">Discord username</Label>
        <Input
          id="invite-discord"
          name="discordUsername"
          placeholder="e.g. foxdev"
          autoComplete="off"
          required
        />
        <FieldError errors={state.fieldErrors?.discordUsername} />
      </div>
      <div className="sm:w-44">
        <Label htmlFor="invite-role">Role</Label>
        <Select name="role" defaultValue="COLLAB_MANAGER">
          <SelectTrigger id="invite-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ADMIN">{ROLE_META.ADMIN.label}</SelectItem>
            <SelectItem value="COLLAB_MANAGER">{ROLE_META.COLLAB_MANAGER.label}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <SubmitButton pendingText="Adding…">
        <UserPlus className="h-4 w-4" />
        Add
      </SubmitButton>
    </form>
  );
}

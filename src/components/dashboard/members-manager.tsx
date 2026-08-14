"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Trash2, Copy, Check, Shield, Crown, Pencil } from "lucide-react";

import {
  changeRoleAction,
  removeMemberAction,
  revokeInviteAction,
} from "@/server/actions/team";
import { ROLE_META, roleAtLeast } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TeamRole } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type MemberVM = {
  id: string;
  role: TeamRole;
  user: { id: string; name: string | null; email: string | null; image: string | null };
};

type InviteVM = {
  id: string;
  email: string;
  role: TeamRole;
  token: string;
  expiresAt: string;
};

const ROLE_ICON: Record<TeamRole, typeof Shield> = {
  OWNER: Crown,
  ADMIN: Shield,
  EDITOR: Pencil,
};

/**
 * MembersManager — role changes, removal, and pending-invite management.
 * The current viewer's role governs which controls are enabled; the server
 * re-checks every action regardless.
 */
export function MembersManager({
  teamId,
  members,
  invites,
  viewerRole,
  viewerUserId,
}: {
  teamId: string;
  members: MemberVM[];
  invites: InviteVM[];
  viewerRole: TeamRole;
  viewerUserId: string;
}) {
  const canManage = roleAtLeast(viewerRole, "ADMIN");

  return (
    <div className="space-y-8">
      {/* Members */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
        <div className="border-b border-border/60 px-5 py-3">
          <h2 className="font-display text-base font-semibold text-white">
            Members ({members.length})
          </h2>
        </div>
        <ul className="divide-y divide-border/60">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              teamId={teamId}
              member={m}
              viewerRole={viewerRole}
              canManage={canManage}
              isSelf={m.user.id === viewerUserId}
            />
          ))}
        </ul>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
          <div className="border-b border-border/60 px-5 py-3">
            <h2 className="font-display text-base font-semibold text-white">
              Pending invites ({invites.length})
            </h2>
          </div>
          <ul className="divide-y divide-border/60">
            {invites.map((inv) => (
              <InviteRow
                key={inv.id}
                teamId={teamId}
                invite={inv}
                canManage={canManage}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MemberRow({
  teamId,
  member,
  viewerRole,
  canManage,
  isSelf,
}: {
  teamId: string;
  member: MemberVM;
  viewerRole: TeamRole;
  canManage: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const RoleIcon = ROLE_ICON[member.role];

  // Only owners can modify owners or grant ownership.
  const canEditThis =
    canManage &&
    (viewerRole === "OWNER" || member.role === "EDITOR" || member.role === "ADMIN") &&
    !(member.role === "OWNER" && viewerRole !== "OWNER");

  const roleOptions: TeamRole[] =
    viewerRole === "OWNER" ? ["OWNER", "ADMIN", "EDITOR"] : ["ADMIN", "EDITOR"];

  function onRoleChange(role: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("memberId", member.id);
      fd.set("role", role);
      const res = await changeRoleAction(teamId, { ok: false }, fd);
      if (res.ok) toast.success(res.message ?? "Role updated.");
      else toast.error(res.error ?? "Could not update role.");
    });
  }

  function onRemove() {
    startTransition(async () => {
      const res = await removeMemberAction(teamId, member.id);
      if (res.ok) toast.success(res.message ?? "Member removed.");
      else toast.error(res.error ?? "Could not remove member.");
    });
  }

  const name = member.user.name ?? member.user.email ?? "Unknown";
  const initials = name.split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <li className={cn("flex items-center gap-4 px-5 py-4", pending && "opacity-60")}>
      <Avatar className="h-9 w-9">
        {member.user.image && <AvatarImage src={member.user.image} alt={name} />}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {name}
          {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
        </p>
        {member.user.email && (
          <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
        )}
      </div>

      {canEditThis && !isSelf ? (
        <Select
          defaultValue={member.role}
          onValueChange={onRoleChange}
          disabled={pending}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roleOptions.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_META[r].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Badge variant={member.role === "OWNER" ? "gold" : "muted"}>
          <RoleIcon className="h-3 w-3" />
          {ROLE_META[member.role].label}
        </Badge>
      )}

      {canManage && !isSelf && member.role !== "OWNER" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
              Remove from project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

function InviteRow({
  teamId,
  invite,
  canManage,
}: {
  teamId: string;
  invite: InviteVM;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function copyLink() {
    const url = `${window.location.origin}/dashboard/invite/${invite.token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast.success("Invite link copied.");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function onRevoke() {
    startTransition(async () => {
      const res = await revokeInviteAction(teamId, invite.id);
      if (res.ok) toast.success(res.message ?? "Invite revoked.");
      else toast.error(res.error ?? "Could not revoke invite.");
    });
  }

  return (
    <li className={cn("flex items-center gap-4 px-5 py-4", pending && "opacity-60")}>
      <div className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-border text-xs text-muted-foreground">
        @
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{invite.email}</p>
        <p className="text-xs text-muted-foreground">
          Invited as {ROLE_META[invite.role].label}
        </p>
      </div>

      <Button variant="outline" size="sm" onClick={copyLink}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy link"}
      </Button>

      {canManage && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={onRevoke}
          disabled={pending}
          title="Revoke invite"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </li>
  );
}

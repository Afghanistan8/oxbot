"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

import { acceptInviteAction } from "@/server/actions/team";
import { Button } from "@/components/ui/button";

/**
 * AcceptInvite — client control that accepts an invite by token and routes to
 * the joined project on success.
 */
export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptInviteAction(token);
      if (res.ok && res.data) {
        toast.success(res.message ?? "You've joined the project.");
        router.push(`/dashboard/${res.data.slug}`);
      } else {
        setError(res.error ?? "Could not accept this invite.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <X className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button onClick={accept} disabled={pending} className="flex-1">
          <Check className="h-4 w-4" />
          {pending ? "Joining…" : "Accept invite"}
        </Button>
        <Button variant="outline" onClick={() => router.push("/dashboard")} disabled={pending}>
          Decline
        </Button>
      </div>
    </div>
  );
}

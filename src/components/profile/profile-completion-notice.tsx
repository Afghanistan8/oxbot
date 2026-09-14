import Link from "next/link";
import { UserCog, ArrowRight } from "lucide-react";

import { getProfileCompletion, type ProfileField } from "@/server/queries/profile";

/**
 * A small banner nudging a signed-in entrant to finish their profile (email,
 * wallet, X, Discord) so a project can reach them and send a prize if they win.
 * Renders nothing when signed out or when the profile is already complete, so
 * it quietly goes away once everything is filled in.
 */

const FIELD_LABELS: Record<ProfileField, string> = {
  email: "email",
  wallet: "a wallet",
  x: "your X account",
  discord: "your Discord",
};

/** Join labels as "a, b and c". */
function listLabels(fields: ProfileField[]): string {
  const labels = fields.map((f) => FIELD_LABELS[f]);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export async function ProfileCompletionNotice({
  userId,
  className = "",
}: {
  userId: string | null;
  className?: string;
}) {
  if (!userId) return null;

  const { complete, missing } = await getProfileCompletion(userId);
  if (complete) return null;

  return (
    <Link
      href="/profile"
      className={`group flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold/[0.06] px-4 py-3 transition-colors hover:border-gold/60 ${className}`}
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
        <UserCog className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">Finish setting up your profile</p>
        <p className="text-xs text-muted-foreground">
          Add {listLabels(missing)} so a project can reach you and send your prize if you win.
        </p>
      </div>
      <span className="hidden shrink-0 items-center gap-1 text-xs font-medium text-gold group-hover:text-white sm:inline-flex">
        Complete profile
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

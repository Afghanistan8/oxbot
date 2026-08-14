import { cn } from "@/lib/utils";

/**
 * FormMessage / FieldError — consistent inline messaging for action forms.
 */

export function FormMessage({
  state,
  className,
}: {
  state?: { ok?: boolean; error?: string; message?: string };
  className?: string;
}) {
  if (!state) return null;
  if (state.error) {
    return (
      <p
        className={cn(
          "rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive",
          className
        )}
        role="alert"
      >
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p
        className={cn(
          "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300",
          className
        )}
      >
        {state.message}
      </p>
    );
  }
  return null;
}

export function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 text-xs text-destructive">{errors[0]}</p>;
}

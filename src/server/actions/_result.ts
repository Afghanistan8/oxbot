/**
 * Shared shapes + helpers for server-action results.
 *
 * Actions return a discriminated result rather than throwing, so client forms
 * (via `useActionState`) can render field + form errors. Helpers here also
 * normalize Zod and Authz errors into that shape.
 */
import { ZodError } from "zod";

import { AuthzError } from "@/lib/authz";

export type FieldErrors = Record<string, string[]>;

export type ActionState<T = undefined> = {
  ok: boolean;
  /** Top-level error message (e.g. permission denied, unexpected error). */
  error?: string;
  /** Per-field validation messages, keyed by field name. */
  fieldErrors?: FieldErrors;
  /** Human-friendly success message. */
  message?: string;
  /** Optional payload on success (e.g. created slug for client redirect). */
  data?: T;
};

export function ok<T>(data?: T, message?: string): ActionState<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: FieldErrors): ActionState<never> {
  return { ok: false, error, fieldErrors };
}

/** Flatten a ZodError into our FieldErrors shape. */
export function zodFieldErrors(err: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/**
 * Wrap an action body so Zod + Authz errors become clean ActionStates and
 * unexpected errors are logged and surfaced generically. `redirect()` throws a
 * special error that MUST propagate, so we rethrow anything Next-flavored.
 */
export async function runAction<T>(
  fn: () => Promise<ActionState<T>>
): Promise<ActionState<T>> {
  try {
    return await fn();
  } catch (err) {
    // Next.js redirect/notFound throw sentinel errors we must not swallow.
    if (isNextControlFlowError(err)) throw err;

    if (err instanceof ZodError) {
      return { ok: false, error: "Please fix the errors below.", fieldErrors: zodFieldErrors(err) };
    }
    if (err instanceof AuthzError) {
      return { ok: false, error: err.message };
    }
    console.error("[action] unexpected error", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Detect Next.js internal redirect/notFound sentinels. */
function isNextControlFlowError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    ((err as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (err as { digest: string }).digest === "NEXT_NOT_FOUND")
  );
}

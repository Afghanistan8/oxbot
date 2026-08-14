"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * SubmitButton — a form submit button that shows a spinner while the enclosing
 * form's server action is pending (via `useFormStatus`).
 */
export function SubmitButton({
  children,
  pendingText,
  className,
  ...props
}: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={cn(className)} {...props}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? pendingText ?? "Working…" : children}
    </Button>
  );
}

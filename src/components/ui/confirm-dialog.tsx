"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * A themed replacement for `window.confirm()` — the native browser dialog
 * ("oxbot-ruby.vercel.app says...") looks jarring against the rest of the app.
 * Mount `<ConfirmDialogProvider>` once near the root; call `useConfirm()`
 * anywhere below it to get an async confirm function with the same shape as
 * `window.confirm` (resolves true/false), styled to match the app.
 */

export type ConfirmOptions = {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "destructive" reddens the confirm button for irreversible actions. */
  variant?: "default" | "destructive";
};

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within <ConfirmDialogProvider>");
  }
  return ctx;
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    const normalized = typeof opts === "string" ? { description: opts } : opts;
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setOptions(normalized);
    });
  }, []);

  function settle(result: boolean) {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setOptions(null);
  }

  const destructive = options?.variant === "destructive";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={options !== null} onOpenChange={(open) => !open && settle(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div
              className={
                destructive
                  ? "mb-1 grid h-11 w-11 place-items-center rounded-2xl bg-destructive/15 text-destructive"
                  : "mb-1 grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary"
              }
            >
              {destructive ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <HelpCircle className="h-5 w-5" />
              )}
            </div>
            <DialogTitle>{options?.title ?? "Are you sure?"}</DialogTitle>
            <DialogDescription>{options?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => settle(false)}>
              {options?.cancelLabel ?? "Cancel"}
            </Button>
            <Button variant={destructive ? "destructive" : "default"} onClick={() => settle(true)}>
              {options?.confirmLabel ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

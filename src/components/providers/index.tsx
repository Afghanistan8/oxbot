"use client";

import { SessionProvider } from "next-auth/react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";

/**
 * Global client-side providers: Auth.js session context, tooltip context, the
 * themed toast host, and the themed confirm-dialog host (replaces the native
 * `window.confirm()` browser popup everywhere in the app).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TooltipProvider delayDuration={200}>
        <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
      </TooltipProvider>
      <Toaster position="top-center" richColors closeButton />
    </SessionProvider>
  );
}

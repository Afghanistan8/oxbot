"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toaster — themed to the crimson system. Fixed to dark theme with red-tinted
 * surfaces so notifications match the rest of oxbot.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-glow-red group-[.toaster]:rounded-2xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error:
            "group-[.toaster]:!border-destructive/40 group-[.toaster]:!text-destructive-foreground",
          success: "group-[.toaster]:!border-emerald-500/40",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

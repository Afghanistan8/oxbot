"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * CopyCode — a monospace value with a one-click copy button. Used on /guide
 * for the bot-invite link and similar strings people need to paste elsewhere.
 */
export function CopyCode({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-ink-black/60 p-2 pl-4">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground/90 sm:text-sm">
        {value}
      </code>
      <Button type="button" variant="outline" size="sm" onClick={copy} className="shrink-0">
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : (label ?? "Copy")}
      </Button>
    </div>
  );
}

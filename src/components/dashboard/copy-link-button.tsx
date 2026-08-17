"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/** CopyLinkButton — one-click copy of a giveaway's public share URL. */
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        toast.success("Link copied.");
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("Couldn't copy — copy it from the address bar instead.")
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

"use client";

import { useRef, useState } from "react";
import { ImageUp, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * ImageUploadField — a controlled logo/banner picker. Uploads immediately via
 * POST /api/uploads on file select, previews the result, and carries the
 * final URL in a hidden input so the enclosing form submits it like any other
 * field. Falls back gracefully to whatever `defaultValue` the team already has.
 */
export function ImageUploadField({
  name,
  label,
  folder,
  defaultValue,
  aspect = "square",
}: {
  name: string;
  label: string;
  folder: "logos" | "banners";
  defaultValue?: string | null;
  aspect?: "square" | "wide";
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPending(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("folder", folder);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      setUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-foreground">{label}</p>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-ink-black/40",
            aspect === "square" ? "h-16 w-16" : "h-16 w-28"
          )}
        >
          {pending ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageUp className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              {pending ? "Uploading…" : url ? "Replace" : "Upload"}
            </Button>
            {url && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setUrl("")}
                aria-label={`Remove ${label.toLowerCase()}`}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">PNG, JPG, WEBP, or GIF · max 5 MB</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onSelect}
      />
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}

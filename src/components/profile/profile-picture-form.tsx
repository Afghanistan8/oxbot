"use client";

import { useActionState, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";

import { updateProfileImageAction } from "@/server/actions/profile";
import { ActionState } from "@/server/actions/_result";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/dashboard/submit-button";
import { FormMessage } from "@/components/dashboard/form-message";

const initial: ActionState = { ok: false };
const MAX_DIMENSION = 256;

/**
 * Resize + center-crop an image file to a square JPEG data URL, entirely in
 * the browser. Kept small (JPEG, capped dimension) so it can be stored inline
 * on `User.image` — see updateProfileImageAction for why we avoid a real file
 * upload here (it wouldn't persist on Vercel's serverless filesystem).
 */
function fileToSquareDataUrl(file: File, size = MAX_DIMENSION): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported."));

      // Center-crop the source to a square before scaling down.
      const src = Math.min(img.width, img.height);
      const sx = (img.width - src) / 2;
      const sy = (img.height - src) / 2;
      ctx.drawImage(img, sx, sy, src, src, 0, 0, size, size);

      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read that image."));
    };
    img.src = objectUrl;
  });
}

export function ProfilePictureForm({
  name,
  email,
  image,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
}) {
  const [state, formAction] = useActionState(updateProfileImageAction, initial);
  const [preview, setPreview] = useState(image ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const initials = (name ?? email ?? "?")
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPending(true);
    try {
      const dataUrl = await fileToSquareDataUrl(file);
      setPreview(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process that image.");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="image" value={preview} />
      <FormMessage state={state} />

      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 border border-border">
          {preview && <AvatarImage src={preview} alt="" />}
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            {preview ? "Change" : "Upload"}
          </Button>
          {preview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setPreview("")}
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </Button>
          )}
          <SubmitButton pendingText="Saving…" size="sm">
            Save
          </SubmitButton>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onSelect}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

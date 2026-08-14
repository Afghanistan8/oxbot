import { NextResponse } from "next/server";

import { getCurrentUserId } from "@/lib/session";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { storeUpload } from "@/lib/integrations/uploads";

/**
 * Generic image upload endpoint — any signed-in user (logos, banners, and
 * similar branding assets used across team/giveaway forms). Team-level
 * authorization for *using* the resulting URL is enforced by the form's own
 * server action; this route only ever writes a new file, never touches
 * existing team/giveaway data.
 */
export const dynamic = "force-dynamic";

const ALLOWED_FOLDERS = new Set(["logos", "banners", "misc"]);

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const rl = rateLimit(`upload:${userId}`, RATE_LIMITS.mutate.limit, RATE_LIMITS.mutate.windowMs);
  if (!rl.success) return new NextResponse("Too many uploads. Please slow down.", { status: 429 });

  const form = await req.formData();
  const file = form.get("file");
  const folderRaw = String(form.get("folder") ?? "misc");
  const folder = ALLOWED_FOLDERS.has(folderRaw) ? folderRaw : "misc";

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  try {
    const result = await storeUpload(
      { arrayBuffer: () => file.arrayBuffer(), type: file.type, size: file.size },
      folder
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
